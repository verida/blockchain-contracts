// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibCommon } from "../libraries/LibCommon.sol";
import { LibDataCenter } from "../libraries/LibDataCenter.sol";
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

contract VDAStorageNodeManagementFacet is IStorageNodeManagement {
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableMap for EnumerableMap.AddressToUintMap;

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
  function storeNodeInfo(StorageNodeInput memory nodeInfo) internal virtual {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    {
      uint nodeId = ++ds._nodeIdCounter;
      LibStorageNode.StorageNode storage node = ds._nodeMap[nodeId];

      node.name = nodeInfo.name;
      node.didAddress = nodeInfo.didAddress;
      node.endpointUri = nodeInfo.endpointUri;
      node.countryCode = nodeInfo.countryCode;
      node.regionCode = nodeInfo.regionCode;
      node.datacenterId = nodeInfo.datacenterId;
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

      LibDataCenter.increaseDataCenterNodeCount(nodeInfo.datacenterId);
    }

    emit AddNode(
      nodeInfo.name,
      nodeInfo.didAddress, 
      nodeInfo.endpointUri, 
      nodeInfo.countryCode, 
      nodeInfo.regionCode, 
      nodeInfo.datacenterId,
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
      LibDataCenter.checkDataCenterIdActive(nodeInfo.datacenterId);
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
        nodeInfo.datacenterId);
          
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

    storeNodeInfo(nodeInfo);
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

    // Decrease active node count for data center
    LibDataCenter.decreaseDataCenterNodeCount(nodeInfo.datacenterId);
    
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
    * @notice Filter nodes with inputed status
    * @dev Used for `getNodesByCountry()` and `getNodesByRegion()` functions
    * @param ids ID set
    * @param status Target status of storage nodes
    * @return StorageNode[] Array of active storage nodes
    */
  function filterStorageNodes(EnumerableSet.UintSet storage ids, LibCommon.EnumStatus status) internal view virtual returns(LibStorageNode.StorageNode[] memory) {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();

    uint count = ids.length();
    uint size;

    {
        uint nodeId;
        for (uint i; i < count;) {
            nodeId = ids.at(i);
            if (ds._nodeMap[nodeId].status == status) {
                ++size;
            }
            unchecked { ++i; }
        }
    }

    LibStorageNode.StorageNode[] memory nodeList = new LibStorageNode.StorageNode[](size);
    {
        uint nodeId;
        uint index;
        for (uint i; i < count;) {
            nodeId = ids.at(i);
            if (ds._nodeMap[nodeId].status == status) {
                nodeList[index] = ds._nodeMap[nodeId];
                ++index;
            }
            unchecked { ++i; }
        }
    }
    return nodeList;
  }

  /**
   * @notice Get the node list from node ids array
   * @param ids Array of nodeIds
   * @return StorageNode[] Array of storage node
   */
  function getAllStorageNodes(EnumerableSet.UintSet storage ids) internal view virtual returns(LibStorageNode.StorageNode[] memory) {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    
    uint count = ids.length();
    LibStorageNode.StorageNode[] memory nodeList = new LibStorageNode.StorageNode[](count);

    uint nodeId;
    for (uint i; i < count;) {
        nodeId = ids.at(i);
        nodeList[i] = ds._nodeMap[nodeId];
        unchecked { ++i; }
    }
    return nodeList;
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function getNodesByCountry(string calldata countryCode) external view virtual override returns(LibStorageNode.StorageNode[] memory) {
    return getAllStorageNodes(LibStorageNode.nodeStorage()._countryNodeIds[countryCode]);
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function getNodesByCountryAndStatus(string calldata countryCode, LibCommon.EnumStatus status) external view returns(LibStorageNode.StorageNode[] memory) {
    return filterStorageNodes(LibStorageNode.nodeStorage()._countryNodeIds[countryCode], status);
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function getNodesByRegion(string calldata regionCode) external view virtual override returns(LibStorageNode.StorageNode[] memory) {
    return getAllStorageNodes(LibStorageNode.nodeStorage()._regionNodeIds[regionCode]);
  }

  /**
    * @dev see { IStorageNodeManagement }
    */
  function getNodesByRegionAndStatus(string calldata regionCode, LibCommon.EnumStatus status) external view returns(LibStorageNode.StorageNode[] memory) {
    return filterStorageNodes(LibStorageNode.nodeStorage()._regionNodeIds[regionCode], status);
  }
}
