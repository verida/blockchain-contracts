// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibCommon } from "../libraries/LibCommon.sol";
import { LibDataCentre } from "../libraries/LibDataCentre.sol";
import { LibStorageNode } from "../libraries/LibStorageNode.sol";
import { LibVerification } from "../libraries/LibVerification.sol";
import { LibUtils } from "../libraries/LibUtils.sol";
import { IStorageNodeManagement } from "../interfaces/IStorageNodeManagement.sol"; 

// import "hardhat/console.sol";

error InvalidName();
error InvalidDIDAddress();
error InvalidEndpointUri();
error InvalidUnregisterTime();
error InvalidSlotCount();
// error InvalidValue();
error InvalidFallbackNodeAddress();
error InvalidFallbackNodeProofTime();
error InvalidAvailableSlots();
error InsufficientFallbackSlots();
error InvalidPageSize();
error InvalidPageNumber();

contract VDAStorageNodeManagementFacet is IStorageNodeManagement {
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableMap for EnumerableMap.AddressToUintMap;

  uint internal constant PAGE_SIZE_LIMIT = 100;

  /**
    * @dev see { IStorageNodeManagement }
    */
  function nonce(address did) external view virtual override returns(uint) {
    return LibVerification.diamondStorage().nonce[did];
  }
  
  /**
    * @notice Store node information to the storage and emit the event
    * @dev Internal function used in the `addNode()` function. Created for stack deep error
    * @param nodeInfo Node information to store
    */
  function _storeNodeInfo(StorageNodeInput memory nodeInfo) internal virtual {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    {
      uint nodeId = ++ds._nodeIdCounter;
      LibStorageNode.StorageNode storage node = ds._nodeMap[nodeId];

      node.name = nodeInfo.name;
      node.didAddress = nodeInfo.didAddress;
      node.endpointUri = nodeInfo.endpointUri;
      node.countryCode = nodeInfo.countryCode;
      node.regionCode = nodeInfo.regionCode;
      node.datacentreId = nodeInfo.datacentreId;
      node.lat = nodeInfo.lat;
      node.long = nodeInfo.long;
      node.slotCount = nodeInfo.slotCount;
      node.establishmentDate = block.timestamp;
      node.acceptFallbackSlots = nodeInfo.acceptFallbackSlots;
      node.status = LibCommon.EnumStatus.active;

      ds._nameNodeId[nodeInfo.name] = nodeId;
      ds._didNodeId[nodeInfo.didAddress] = nodeId;
      ds._endpointNodeId[nodeInfo.endpointUri] = nodeId;
      ds._countryNodeIds[nodeInfo.countryCode].add(nodeId);
      ds._regionNodeIds[nodeInfo.regionCode].add(nodeId);

      LibDataCentre.increaseDataCentreNodeCount(nodeInfo.datacentreId);
    }

    emit AddNode(
      nodeInfo.name,
      nodeInfo.didAddress, 
      nodeInfo.endpointUri, 
      nodeInfo.countryCode, 
      nodeInfo.regionCode, 
      nodeInfo.datacentreId,
      nodeInfo.lat,
      nodeInfo.long,
      nodeInfo.slotCount,
      nodeInfo.acceptFallbackSlots,
      block.timestamp
    );
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function addNode(
      StorageNodeInput calldata nodeInfo,
      bytes calldata requestSignature,
      bytes calldata requestProof,
      bytes calldata authSignature
  ) external virtual override {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    {
      if (bytes(nodeInfo.name).length == 0 || !LibUtils.isLowerCase(nodeInfo.name)) {
        revert InvalidName();
      }

      // Check whether endpointUri is empty
      if (bytes(nodeInfo.endpointUri).length == 0) {
          revert InvalidEndpointUri();
      }

      LibUtils.validateCountryCode(nodeInfo.countryCode);
      LibUtils.validateRegionCode(nodeInfo.regionCode);
      LibDataCentre.checkDataCentreIdActive(nodeInfo.datacentreId);
      LibUtils.validateGeoPosition(nodeInfo.lat, nodeInfo.long);

      // Check whether name was registered before
      if (ds._nameNodeId[nodeInfo.name] != 0)  {
        revert InvalidName();
      }
      
      // Check whether didAddress was registered before
      if (ds._didNodeId[nodeInfo.didAddress] != 0) {
        revert InvalidDIDAddress();
      }

      // Check whether endpoint was registered before
      if (ds._endpointNodeId[nodeInfo.endpointUri] != 0) {
        revert InvalidEndpointUri();
      }

      // Check whether the slotCount is zero
      if (nodeInfo.slotCount < ds.MIN_SLOTS || nodeInfo.slotCount > ds.MAX_SLOTS) {
        revert InvalidSlotCount();
      }
      
      bytes memory params = abi.encodePacked(
        nodeInfo.name,
        nodeInfo.didAddress,
        nodeInfo.endpointUri,
        nodeInfo.countryCode);

      params = abi.encodePacked(
        params,
        nodeInfo.regionCode,
        nodeInfo.datacentreId);
          
      params = abi.encodePacked(
        params,
        nodeInfo.lat,
        nodeInfo.long,
        nodeInfo.slotCount,
        nodeInfo.acceptFallbackSlots
      );

      LibVerification.verifyRequest(nodeInfo.didAddress, params, requestSignature, requestProof);
      LibVerification.verifyAuthSignature(nodeInfo.didAddress, authSignature);
    }

    if (ds.isStakingRequired) {
      uint totalAmount = LibStorageNode.requiredTokenAmount(nodeInfo.slotCount);
      IERC20(ds.vdaTokenAddress).transferFrom(tx.origin, address(this), totalAmount);

      ds._stakedTokenAmount[nodeInfo.didAddress] = ds._stakedTokenAmount[nodeInfo.didAddress] + totalAmount;
    }

    _storeNodeInfo(nodeInfo);
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function removeNodeStart(
      address didAddress,
      uint unregisterDateTime,
      FallbackNodeInfo calldata fallbackInfo,
      bytes calldata requestSignature,
      bytes calldata requestProof
  ) external virtual override {

    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    uint nodeId = ds._didNodeId[didAddress];
    uint fallbackNodeId = ds._didNodeId[fallbackInfo.fallbackNodeAddress];

    LibStorageNode.StorageNode storage nodeInfo = ds._nodeMap[nodeId];

    {
      // Check whether didAddress was registered before
      if (nodeId == 0 || 
        nodeInfo.status != LibCommon.EnumStatus.active ||
        ds._isFallbackSet[didAddress]
      ) {
        revert InvalidDIDAddress();
      }

      // Check whether unregistertime is after 28 days from now
      if (unregisterDateTime < (block.timestamp + 28 days)) {
        revert InvalidUnregisterTime();
      }

      LibStorageNode.StorageNode storage fallbackNode = ds._nodeMap[fallbackNodeId];
      // Check whether fallback node registered and its' status is active
      if (fallbackNodeId == 0 || 
          fallbackNode.status != LibCommon.EnumStatus.active ||
          !fallbackNode.acceptFallbackSlots  ||
          ds._isFallbackSet[fallbackInfo.fallbackNodeAddress]
      ) {
        revert InvalidFallbackNodeAddress();
      }

      // Check available slots
      if (fallbackInfo.availableSlots > fallbackNode.slotCount) {
        revert InvalidAvailableSlots();
      }
      if (fallbackInfo.availableSlots < nodeInfo.slotCount) {
        revert InsufficientFallbackSlots();
      }

      // Verify the `availableSlotsProof`
      if (fallbackInfo.fallbackProofTime < (block.timestamp - 30 minutes)) {
        revert InvalidFallbackNodeProofTime();
      }

      bytes memory params = abi.encodePacked(
        fallbackInfo.fallbackNodeAddress,
        "/",
        fallbackInfo.availableSlots,
        "/",
        fallbackInfo.fallbackProofTime
      );
      LibVerification.verifyFallbackNodeSignature(fallbackInfo.fallbackNodeAddress, params, fallbackInfo.availableSlotsProof);

      // Verify the request
      params = abi.encodePacked(
        didAddress, 
        unregisterDateTime, 
        fallbackInfo.fallbackNodeAddress,
        fallbackInfo.availableSlots,
        fallbackInfo.fallbackProofTime,
        fallbackInfo.availableSlotsProof
      );
      LibVerification.verifyRequest(didAddress, params, requestSignature, requestProof);
    }

    // Change status to `removing`
    nodeInfo.status = LibCommon.EnumStatus.removing;
    nodeInfo.fallbackNodeAddress = fallbackInfo.fallbackNodeAddress;
    nodeInfo.unregisterTime = unregisterDateTime;

    ds._isFallbackSet[fallbackInfo.fallbackNodeAddress] = true;
    
    emit RemoveNodeStart(didAddress, unregisterDateTime, fallbackInfo.fallbackNodeAddress);
  }
  
  /**
    * @dev see { IStorageNodeManagement }
    */
  function removeNodeComplete(
      address didAddress,
      address fundReleasedTo,
      bytes calldata fallbackMigrationProof,
      bytes calldata requestSignature,
      bytes calldata requestProof
  ) external virtual override {

    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    uint nodeId = ds._didNodeId[didAddress];
    LibStorageNode.StorageNode storage nodeInfo = ds._nodeMap[nodeId];

    {
      if (nodeId == 0 || nodeInfo.status != LibCommon.EnumStatus.removing) {
          revert InvalidDIDAddress();
      }

      if (nodeInfo.unregisterTime > block.timestamp) {
          revert InvalidUnregisterTime();
      }

      // Verify the migration proof
      bytes memory params = abi.encodePacked(
        didAddress,
        "/",
        nodeInfo.fallbackNodeAddress,
        "-migrated"
      );
      LibVerification.verifyFallbackNodeSignature(nodeInfo.fallbackNodeAddress, params, fallbackMigrationProof);

      // Verify the request
      params = abi.encodePacked(didAddress, fundReleasedTo, fallbackMigrationProof);
      LibVerification.verifyRequest(didAddress, params, requestSignature, requestProof);
    }

    // Release staked token
    uint totalAmount = ds._stakedTokenAmount[didAddress];
    if (totalAmount != 0) {
        IERC20(ds.vdaTokenAddress).transfer(fundReleasedTo, totalAmount);
        ds._stakedTokenAmount[didAddress] = 0;
    }        

    // Update the status
    nodeInfo.status = LibCommon.EnumStatus.removed;

    // Decrease active node count for data centre
    LibDataCentre.decreaseDataCentreNodeCount(nodeInfo.datacentreId);
    
    // Release fallback node to free
    address fallbackAddress = nodeInfo.fallbackNodeAddress;
    delete ds._isFallbackSet[fallbackAddress];

    emit RemoveNodeComplete(didAddress, fallbackAddress, fundReleasedTo);
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function isRegisteredNodeName(string calldata name) external view returns(bool) {
    return LibStorageNode.nodeStorage()._nameNodeId[name] != 0;
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function isRegisteredNodeAddress(address didAddress) external view returns(bool) {
    return LibStorageNode.nodeStorage()._didNodeId[didAddress] != 0;
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function isRegisteredNodeEndpoint(string calldata endpointUri) external view returns(bool) {
    return LibStorageNode.nodeStorage()._endpointNodeId[endpointUri] != 0;
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function getNodeByName(string calldata name) external view returns(LibStorageNode.StorageNode memory) {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    uint nodeId = ds._nameNodeId[name];
    if (nodeId == 0) {
        revert InvalidName();
    }

    return ds._nodeMap[nodeId];
  }
  
  /**
    * @dev see { IStorageNodeManagement }
    */
  function getNodeByAddress(address didAddress) external view virtual override returns(LibStorageNode.StorageNode memory) {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    uint nodeId = ds._didNodeId[didAddress];
    if (nodeId == 0) {
        revert InvalidDIDAddress();
    }

    return ds._nodeMap[nodeId];
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function getNodeByEndpoint(string calldata endpointUri) external view virtual override returns(LibStorageNode.StorageNode memory) {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    uint nodeId = ds._endpointNodeId[endpointUri];

    if (nodeId == 0) {
        revert InvalidEndpointUri();
    }

    return ds._nodeMap[nodeId];
  }

  /**
   * @notice Revert if page information is not valid
   * @param pageSize Number of maximum elements of returned
   * @param pageNumber Page index. Starts from 1
   */
  function _validatePageInformation(uint pageSize, uint pageNumber) internal pure {
    if (pageSize == 0 || pageSize > PAGE_SIZE_LIMIT) {
      revert InvalidPageSize();
    }

    if (pageNumber == 0) {
      revert InvalidPageNumber();
    }
  }

  /**
    * @notice Filter nodes with inputed status
    * @dev Used for `getNodesByCountryCode()` and `getNodesByRegionCode()` functions
    * @param ids ID set
    * @param status Target status of storage nodes
    * @param pageSize Number of maximum elements of returned
    * @param pageNumber Page index. Starts from 1
    * @return StorageNode[] Array of active storage nodes
    */
  function _filterNodesByStatus(
    EnumerableSet.UintSet storage ids, 
    LibCommon.EnumStatus status,
    uint pageSize,
    uint pageNumber
  ) internal view virtual returns(LibStorageNode.StorageNode[] memory) {

    _validatePageInformation(pageSize, pageNumber);

    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();

    uint count = ids.length();
    uint size;

    LibStorageNode.StorageNode[] memory nodeList = new LibStorageNode.StorageNode[](pageSize);

    unchecked {
      uint pageStartIndex = pageSize * (pageNumber - 1);
      uint pageEndIndex = pageStartIndex + pageSize;
      uint nodeId;

      if (pageStartIndex >= count) {
        return new LibStorageNode.StorageNode[](0);
      }
      
      for (uint i; i < count && size < pageEndIndex;) {
          nodeId = ids.at(i);
          if (ds._nodeMap[nodeId].status == status) {
              if (size >= pageStartIndex) {
                nodeList[size - pageStartIndex] = ds._nodeMap[nodeId];
              }
              ++size;
          }
          ++i;
      }

      if (size < pageStartIndex) {
        return new LibStorageNode.StorageNode[](0);
      } else if (size == pageEndIndex) {
        return nodeList;
      } 

      // Decrease Array Length
      uint len = size - pageStartIndex;
      LibStorageNode.StorageNode[] memory retList = new LibStorageNode.StorageNode[](len);
      for (uint i; i < len;) {
        retList[i] = nodeList[i];
        ++i;
      }
      return retList;
    }
  }

  /**
   * @notice Get the node list from node ids array
   * @param ids Array of nodeIds
   * @param pageSize Number of maximum elements of returned
   * @param pageNumber Page index. Starts from 1
   * @return StorageNode[] Array of storage node
   */
  function _getNodesById(EnumerableSet.UintSet storage ids, uint pageSize, uint pageNumber) internal view virtual returns(LibStorageNode.StorageNode[] memory) {
    if (pageSize == 0 || pageSize > PAGE_SIZE_LIMIT) {
      revert InvalidPageSize();
    }
    if (pageNumber == 0) {
      revert InvalidPageNumber();
    }
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();

    uint count = ids.length();

    uint pageStartIndex = pageSize * (pageNumber - 1);
    uint pageEndIndex = pageStartIndex + pageSize;
    
    if (pageStartIndex >= count) {
      return new LibStorageNode.StorageNode[](0);
    }

    if (pageEndIndex > count) {
      pageEndIndex = count;
    }

    LibStorageNode.StorageNode[] memory nodeList = new LibStorageNode.StorageNode[](pageEndIndex - pageStartIndex);

    uint nodeId;
    for (uint i = pageStartIndex; i < pageEndIndex;) {
        nodeId = ids.at(i);
        nodeList[i-pageStartIndex] = ds._nodeMap[nodeId];
        unchecked { ++i; }
    }
    return nodeList;
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function getNodesByCountryCode(
    string calldata countryCode, 
    uint pageSize, 
    uint pageNumber
  ) external view virtual override returns(LibStorageNode.StorageNode[] memory) {
    return _getNodesById(LibStorageNode.nodeStorage()._countryNodeIds[countryCode], pageSize, pageNumber);
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function getNodesByCountryCodeAndStatus(
    string calldata countryCode, 
    LibCommon.EnumStatus status,
    uint pageSize, 
    uint pageNumber
  ) external view returns(LibStorageNode.StorageNode[] memory) {
    return _filterNodesByStatus(LibStorageNode.nodeStorage()._countryNodeIds[countryCode], status, pageSize, pageNumber);
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function getNodesByRegionCode(
    string calldata regionCode,
    uint pageSize, 
    uint pageNumber
  ) external view virtual override returns(LibStorageNode.StorageNode[] memory) {
    return _getNodesById(LibStorageNode.nodeStorage()._regionNodeIds[regionCode], pageSize, pageNumber);
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function getNodesByRegionCodeAndStatus(
    string calldata regionCode, 
    LibCommon.EnumStatus status,
    uint pageSize, 
    uint pageNumber
  ) external view returns(LibStorageNode.StorageNode[] memory) {
    return _filterNodesByStatus(LibStorageNode.nodeStorage()._regionNodeIds[regionCode], status, pageSize, pageNumber);
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function getNodesByStatus(
    LibCommon.EnumStatus status,
    uint pageSize, 
    uint pageNumber
  ) external view returns(LibStorageNode.StorageNode[] memory) {
    _validatePageInformation(pageSize, pageNumber);

    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    uint count = ds._nodeIdCounter;
    uint size;


    LibStorageNode.StorageNode[] memory nodeList = new LibStorageNode.StorageNode[](pageSize);

    unchecked {
      uint pageStartIndex = pageSize * (pageNumber - 1);
      uint pageEndIndex = pageStartIndex + pageSize;

      if (pageStartIndex >= count) {
        return new LibStorageNode.StorageNode[](0);
      }

      for(uint i; i<count && size < pageEndIndex;) {
        if (ds._nodeMap[i+1].status == status) {
          if (size >= pageStartIndex) {
            nodeList[size-pageStartIndex] = ds._nodeMap[i+1];
          }
          ++size;
        }
        ++i;
      }

      if (size < pageStartIndex) {
        return new LibStorageNode.StorageNode[](0);
      } else if (size == pageEndIndex) {
        return nodeList;
      }

      // Decrease length
      uint len = size - pageStartIndex;
      LibStorageNode.StorageNode[] memory retList = new LibStorageNode.StorageNode[](len);
      for (uint i; i < len;) {
        retList[i] = nodeList[i];
        ++i;
      }
      return retList;
    }
  }
}
