// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibDataCenter } from "../libraries/LibDataCenter.sol";
import { LibStorageNode } from "../libraries/LibStorageNode.sol";
import { LibVerification } from "../libraries/LibVerification.sol";
import { LibUtils } from "../libraries/LibUtils.sol";
import { IStorageNode } from "../interfaces/IStorageNode.sol"; 

// import "hardhat/console.sol";

error InvalidDIDAddress();
error InvalidEndpointUri();
error InvalidUnregisterTime();
error InvalidSlotCount();
error InvalidValue();

error NoExcessTokenAmount();
error TimeNotElapsed(); // `LOG_LIMIT_PER_DAY` logs in 24 hour
error InvalidSameNodeTime();   
error InvalidAmount();
error InvalidReasonCode();

contract VDAStorageNodeFacet is IStorageNode {
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableMap for EnumerableMap.AddressToUintMap;

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function nonce(address did) external view  virtual override returns(uint) {
      return LibVerification.nonce(did);
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

        node.didAddress = nodeInfo.didAddress;
        node.endpointUri = nodeInfo.endpointUri;
        node.countryCode = nodeInfo.countryCode;
        node.regionCode = nodeInfo.regionCode;
        node.datacenterId = nodeInfo.datacenterId;
        node.lat = nodeInfo.lat;
        node.long = nodeInfo.long;
        node.slotCount = nodeInfo.slotCount;
        node.establishmentDate = block.timestamp;

        ds._didNodeId[nodeInfo.didAddress] = nodeId;
        ds._endpointNodeId[nodeInfo.endpointUri] = nodeId;
        ds._countryNodeIds[nodeInfo.countryCode].add(nodeId);
        ds._regionNodeIds[nodeInfo.regionCode].add(nodeId);

        LibDataCenter.increaseDataCenterNodeCount(nodeInfo.datacenterId);
    }

    emit AddNode(
        nodeInfo.didAddress, 
        nodeInfo.endpointUri, 
        nodeInfo.countryCode, 
        nodeInfo.regionCode, 
        nodeInfo.datacenterId,
        nodeInfo.lat,
        nodeInfo.long,
        nodeInfo.slotCount,
        block.timestamp
        );
  }

  /**
    * @notice Calculate the required token amount for slots
    * @dev Internal function. Used in `stakeToken()` and `getExcessTokenAmount()` functions
    * @param numberSlot Number of slots
    * @return uint Required token amount
    */
  function requiredTokenAmount(uint numberSlot) internal view virtual returns(uint) {
      return numberSlot * LibStorageNode.nodeStorage().STAKE_PER_SLOT;
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function addNode(
      StorageNodeInput calldata nodeInfo,
      bytes calldata requestSignature,
      bytes calldata requestProof,
      bytes calldata authSignature
  ) external virtual override {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    {
      // Check whether endpointUri is empty
      if (bytes(nodeInfo.endpointUri).length == 0) {
          revert InvalidEndpointUri();
      }

      LibUtils.validateCountryCode(nodeInfo.countryCode);
      LibUtils.validateRegionCode(nodeInfo.regionCode);
      LibDataCenter.checkDataCenterIdExistance(nodeInfo.datacenterId);
      LibUtils.validateGeoPosition(nodeInfo.lat, nodeInfo.long);
      
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
          nodeInfo.slotCount
      );

      LibVerification.verifyRequest(nodeInfo.didAddress, params, requestSignature, requestProof);
      LibVerification.verifyAuthSignature(nodeInfo.didAddress, authSignature);
    }

    if (ds.isStakingRequired) {
      uint totalAmount = requiredTokenAmount(nodeInfo.slotCount);
      IERC20(ds.vdaTokenAddress).transferFrom(tx.origin, address(this), totalAmount);

      ds._stakedTokenAmount[nodeInfo.didAddress] = ds._stakedTokenAmount[nodeInfo.didAddress] + totalAmount;
    }

    storeNodeInfo(nodeInfo);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function removeNodeStart(
      address didAddress,
      uint unregisterDateTime,
      bytes calldata requestSignature,
      bytes calldata requestProof
  ) external virtual override {

    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    uint nodeId = ds._didNodeId[didAddress];
    {
      // Check whether didAddress was registered before
      if (nodeId == 0 || ds._nodeUnregisterTime[nodeId] != 0) {
          revert InvalidDIDAddress();
      }

      if (unregisterDateTime < (block.timestamp + 28 days)) {
          revert InvalidUnregisterTime();
      }

      bytes memory params = abi.encodePacked(didAddress, unregisterDateTime);
      LibVerification.verifyRequest(didAddress, params, requestSignature, requestProof);
    }

    ds._nodeUnregisterTime[nodeId] = unregisterDateTime;
    
    emit RemoveNodeStart(didAddress, unregisterDateTime);
  }
  
  /**
    * @dev see { IStorageNodeRegistry }
    */
  function removeNodeComplete(
      address didAddress,
      bytes calldata requestSignature,
      bytes calldata requestProof
  ) external virtual override {

    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    uint nodeId = ds._didNodeId[didAddress];
    {
      if (nodeId == 0) {
          revert InvalidDIDAddress();
      }

      if (ds._nodeUnregisterTime[nodeId] == 0 || ds._nodeUnregisterTime[nodeId] > block.timestamp) {
          revert InvalidUnregisterTime();
      }

      bytes memory params = abi.encodePacked(didAddress);
      LibVerification.verifyRequest(didAddress, params, requestSignature, requestProof);
    }

    // Release staked token
    uint totalAmount = ds._stakedTokenAmount[didAddress];
    if (totalAmount != 0) {
        IERC20(ds.vdaTokenAddress).transfer(tx.origin, totalAmount);
        ds._stakedTokenAmount[didAddress] = 0;
    }        

    // Clear registered information
    LibStorageNode.StorageNode storage nodeInfo = ds._nodeMap[nodeId];

    LibDataCenter.decreaseDataCenterNodeCount(nodeInfo.datacenterId);

    ds._countryNodeIds[nodeInfo.countryCode].remove(nodeId);
    ds._regionNodeIds[nodeInfo.regionCode].remove(nodeId);
    delete ds._endpointNodeId[nodeInfo.endpointUri];
    delete ds._didNodeId[didAddress];
    delete ds._nodeMap[nodeId];

    delete ds._nodeUnregisterTime[nodeId];

    emit RemoveNodeComplete(didAddress);
  }

  /**
    * @notice Create tuple for StorageNode with status
    * @param nodeId StorageNode ID created by `addNode()` function
    * @return StorageNode StoargeNode struct
    * @return string Status string
    */
  function getNodeWithStatus(uint nodeId) internal view virtual returns(LibStorageNode.StorageNode memory, string memory) {
    string memory status = "active";
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    if (ds._nodeUnregisterTime[nodeId] != 0) {
        status = "removed";
    }

    return (ds._nodeMap[nodeId], status);
  }

  /**
    * @dev see { IStorageNode }
    */
  function getNodeByAddress(address didAddress) external view virtual override returns(LibStorageNode.StorageNode memory, string memory) {
    uint nodeId = LibStorageNode.nodeStorage()._didNodeId[didAddress];
    if (nodeId == 0) {
        revert InvalidDIDAddress();
    }

    return getNodeWithStatus(nodeId);
  }

  /**
    * @dev see { IStorageNode }
    */
  function getNodeByEndpoint(string calldata endpointUri) external view virtual override returns(LibStorageNode.StorageNode memory, string memory) {
    uint nodeId = LibStorageNode.nodeStorage()._endpointNodeId[endpointUri];

    if (nodeId == 0) {
        revert InvalidEndpointUri();
    }

    return getNodeWithStatus(nodeId);
  }

  /**
    * @notice Filter active node IDs from set
    * @dev Used for `getNodesByCountry()` and `getNodesByRegion()` functions
    * @param ids ID set
    * @return StorageNode[] Array of active storage nodes
    */
  function filterActiveStorageNodes(EnumerableSet.UintSet storage ids) internal view virtual returns(LibStorageNode.StorageNode[] memory) {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();

    uint count = ids.length();
    uint removedCount;

    {
        uint nodeId;
        for (uint i; i < count;) {
            nodeId = ids.at(i);
            if (ds._nodeUnregisterTime[nodeId] != 0) {
                ++removedCount;
            }
            unchecked { ++i; }
        }
    }

    LibStorageNode.StorageNode[] memory nodeList = new LibStorageNode.StorageNode[](count - removedCount);
    {
        uint nodeId;
        uint index;
        for (uint i; i < count;) {
            nodeId = ids.at(i);
            if (ds._nodeUnregisterTime[nodeId] == 0) {
                nodeList[index] = ds._nodeMap[nodeId];
                ++index;
            }
            unchecked { ++i; }
        }
    }

    return nodeList;
  }

  /**
    * @dev see { IStorageNode }
    */
  function getNodesByCountry(string calldata countryCode) external view virtual override returns(LibStorageNode.StorageNode[] memory) {
    return filterActiveStorageNodes(LibStorageNode.nodeStorage()._countryNodeIds[countryCode]);
  }

  /**
    * @dev see { IStorageNode }
    */
  function getNodesByRegion(string calldata regionCode) external view virtual override returns(LibStorageNode.StorageNode[] memory) {
    return filterActiveStorageNodes(LibStorageNode.nodeStorage()._regionNodeIds[regionCode]);
  }

  /**
    * @dev see { IStorageNode }
    */
  function isStakingRequired() external view virtual override returns(bool) {
    return LibStorageNode.nodeStorage().isStakingRequired;
  }

  /**
    * @dev see { IStorageNode }
    */
  function setStakingRequired(bool isRequired) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    if (isRequired == ds.isStakingRequired) {
        revert InvalidValue();
    }

    ds.isStakingRequired = isRequired;
    emit UpdateStakingRequired(isRequired);
  }

  /**
    * @dev see { IStorageNode }
    */
  function getStakePerSlot() external view virtual override returns(uint) {
      return LibStorageNode.nodeStorage().STAKE_PER_SLOT;
  }

  /**
    * @dev see { IStorageNode }
    */
  function updateStakePerSlot(uint newVal) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    if (newVal == 0 || newVal == ds.STAKE_PER_SLOT) {
        revert InvalidValue();
    }

    ds.STAKE_PER_SLOT = newVal;
    emit UpdateStakePerSlot(newVal);
  }

  /**
    * @dev see { IStorageNode }
    */
  function getSlotCountRange() external view virtual override returns(uint, uint) {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    return (ds.MIN_SLOTS, ds.MAX_SLOTS);
  }

  /**
    * @dev see { IStorageNode }
    */
  function updateMinSlotCount(uint minSlots) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    if (minSlots == 0 || minSlots == ds.MIN_SLOTS || minSlots > ds.MAX_SLOTS) {
        revert InvalidValue();
    }

    ds.MIN_SLOTS = minSlots;
    emit UpdateMinSlotCount(minSlots);
  }

  /**
    * @dev see { IStorageNode }
    */
  function updateMaxSlotCount(uint maxSlots) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    if (maxSlots == 0 || maxSlots == ds.MAX_SLOTS || maxSlots < ds.MIN_SLOTS) {
        revert InvalidValue();
    }

    ds.MAX_SLOTS = maxSlots;
    emit UpdateMaxSlotCount(maxSlots);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function getBalance(address didAddress) external view virtual override returns(uint) {
      return LibStorageNode.nodeStorage()._stakedTokenAmount[didAddress];
  }

  /**
    * @notice Calculate the excess token amount for a DID address
    * @dev Internal function used in `excessTokenAmount()` and `withdraw()` functions
    * @param didAddress DID address
    * @return uint Return negative value if staked amount is less than the required amount
    */
  function getExcessTokenAmount(address didAddress) internal view virtual returns(int) {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    uint totalAmount;
    uint nodeId = ds._didNodeId[didAddress];
    if (nodeId != 0 && ds.isStakingRequired) {
        totalAmount = requiredTokenAmount(ds._nodeMap[nodeId].slotCount);    
    }
    
    return (int(ds._stakedTokenAmount[didAddress]) - int(totalAmount));
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function excessTokenAmount(address didAddress) external view virtual override returns(int) {
      return getExcessTokenAmount(didAddress);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function withdraw(
      address didAddress,
      uint amount,
      bytes calldata requestSignature,
      bytes calldata requestProof
  ) external virtual override {
    {
        bytes memory params = abi.encodePacked(didAddress, amount);
        LibVerification.verifyRequest(didAddress, params, requestSignature, requestProof);
    }

    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();

    int excessAmount = getExcessTokenAmount(didAddress);

    if (excessAmount <= 0) {
        revert NoExcessTokenAmount();
    }

    if (amount > uint(excessAmount)) {
        revert InvalidAmount();
    }

    IERC20(ds.vdaTokenAddress).transfer(tx.origin, amount);

    ds._stakedTokenAmount[didAddress] = ds._stakedTokenAmount[didAddress] - amount;

    emit TokenWithdrawn(didAddress, tx.origin, amount);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function depositToken(address didAddress, uint tokenAmount) external virtual override {
      LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
      uint nodeId = ds._didNodeId[didAddress];
      if (nodeId == 0) {
          revert InvalidDIDAddress();
      }

      IERC20(ds.vdaTokenAddress).transferFrom(tx.origin, address(this), tokenAmount);

      ds._stakedTokenAmount[didAddress] = ds._stakedTokenAmount[didAddress] + tokenAmount;

      emit TokenDeposited(didAddress, tx.origin, tokenAmount);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function getNodeIssueFee() external view virtual override returns(uint){
      return LibStorageNode.nodeStorage().NODE_ISSUE_FEE;
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function updateNodeIssueFee(uint value) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();

    if (value == 0 || value == ds.NODE_ISSUE_FEE) {
        revert InvalidValue();
    }
    uint orgFee = ds.NODE_ISSUE_FEE;
    ds.NODE_ISSUE_FEE = value;

    emit UpdateNodeIssueFee(orgFee, value);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function getTotalIssueFee() external view virtual override returns(uint) {
    return LibStorageNode.nodeStorage().totalIssueFee;
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function withdrawIssueFee(address to, uint amount) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    if (amount > ds.totalIssueFee) {
        revert InvalidValue();
    }
    IERC20(ds.vdaTokenAddress).transfer(to, amount);

    ds.totalIssueFee = ds.totalIssueFee - amount;

    emit WithdrawIssueFee(to, amount);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function getSameNodeLogDuration() external view virtual override returns(uint) {
      return LibStorageNode.nodeStorage().SAME_NODE_LOG_DURATION;
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function updateSameNodeLogDuration(uint value) external virtual override {
      LibDiamond.enforceIsContractOwner();
      LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
      if (value == 0 || value == ds.SAME_NODE_LOG_DURATION) {
          revert InvalidValue();
      }
      uint orgVal = ds.SAME_NODE_LOG_DURATION;
      ds.SAME_NODE_LOG_DURATION = value;

      emit UpdateSameNodeLogDuration(orgVal, value);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function getLogLimitPerDay() external view virtual override returns(uint) {
      return LibStorageNode.nodeStorage().LOG_LIMIT_PER_DAY;
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function updateLogLimitPerDay(uint value) external virtual override {
      LibDiamond.enforceIsContractOwner();
      LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
      if (value == 0 || value == ds.LOG_LIMIT_PER_DAY) {
          revert InvalidValue();
      }
      uint orgVal = ds.LOG_LIMIT_PER_DAY;
      ds.LOG_LIMIT_PER_DAY = value;

      emit UpdateLogLimitPerDay(orgVal, value);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function addReasonCode(uint reasonCode, string calldata description) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    if (ds._reasonCodeSet.contains(reasonCode)) {
        revert InvalidReasonCode();
    }
    LibStorageNode.addReasonCode(reasonCode, description);
    emit AddReasonCode(reasonCode, description);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function disableReasonCode(uint reasonCode) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    LibStorageNode.LogReasonCode storage codeInfo = ds._reasonCodeInfo[reasonCode];
    if (codeInfo.active == false) {
        revert InvalidReasonCode();
    }

    codeInfo.active = false;

    unchecked {
        --ds.activeReasonCodeCount;    
    }
    
    emit DisableReasonCode(reasonCode);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function updateReasonCodeDescription(uint reasonCode, string calldata description) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.LogReasonCode storage codeInfo = LibStorageNode.nodeStorage()._reasonCodeInfo[reasonCode];
    if (codeInfo.active == false) {
        revert InvalidReasonCode();
    }

    string memory orgDesc = codeInfo.description;
    codeInfo.description = description;

    emit UpdateReasonCodeDescription(reasonCode, orgDesc, description);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function getReasonCodeDescription(uint reasonCode) external view virtual override returns(string memory) {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    if (!ds._reasonCodeSet.contains(reasonCode)) {
        revert InvalidReasonCode();
    }

    return ds._reasonCodeInfo[reasonCode].description;
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function getReasonCodeList() external view virtual override returns(LogReasonCodeOutput[] memory) {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();

    uint length = ds.activeReasonCodeCount;
    LogReasonCodeOutput[] memory outList = new LogReasonCodeOutput[](length);
    uint codeCount = ds._reasonCodeSet.length();

    uint index;
    for (uint i; i < codeCount;) {
        uint code = ds._reasonCodeSet.at(i);
        if (ds._reasonCodeInfo[code].active) {
            outList[index].reasonCode = code;
            outList[index].description = ds._reasonCodeInfo[code].description;
            unchecked {
                ++index;
            }
        }
        unchecked {
            ++i;
        }
    }

    return outList;
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function logNodeIssue(
      address didAddress,
      address nodeAddress,
      uint reasonCode,
      bytes calldata requestSignature,
      bytes calldata requestProof
  ) external virtual override {
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();
    {
        // Check whether nodeDID is registered
        uint nodeId = ds._didNodeId[nodeAddress];
        if (nodeId == 0) {
            revert InvalidDIDAddress();
        }

        // Check whether did equals to node address
        if (didAddress == nodeAddress) {
            revert InvalidDIDAddress();
        }

        // Check reascon code validity
        if (!ds._reasonCodeInfo[reasonCode].active) {
            revert InvalidReasonCode();
        }

        bytes memory params = abi.encodePacked(didAddress, nodeAddress, reasonCode);
        LibVerification.verifyRequest(didAddress, params, requestSignature, requestProof);
    }
    
    LibStorageNode.DIDLogInformation storage logs = ds._didLogs[didAddress];
    // Check log limit per day
    if (logs._issueList.length >= ds.LOG_LIMIT_PER_DAY) {
        uint earlistTime = logs._issueList[logs.index].time;
        if (block.timestamp - earlistTime < 24 hours) {
            revert TimeNotElapsed();
        }
    }
    // Check 1 hour condition for same node
    for (uint i; i < logs._issueList.length;) {
        if (logs._issueList[i].nodeDID == nodeAddress && 
            (block.timestamp - logs._issueList[i].time) < ds.SAME_NODE_LOG_DURATION) {
            revert InvalidSameNodeTime();
        }
        unchecked { ++i; }
    }

    // Add or update
    if (logs._issueList.length < ds.LOG_LIMIT_PER_DAY) {
        logs._issueList.push(LibStorageNode.IssueInformation(nodeAddress, reasonCode, block.timestamp));
    } else {
        uint index = logs.index;
        logs._issueList[index].nodeDID = nodeAddress;
        logs._issueList[index].reasonCode = reasonCode;
        logs._issueList[index].time = block.timestamp;
        ++index;
        logs.index = index % ds.LOG_LIMIT_PER_DAY;
    }

    // Transfer fees to this contract
    IERC20(ds.vdaTokenAddress).transferFrom(tx.origin, address(this), ds.NODE_ISSUE_FEE);

    ds.totalIssueFee = ds.totalIssueFee + ds.NODE_ISSUE_FEE;

    uint val;
    EnumerableMap.AddressToUintMap storage didReasonLogAmount = ds._loggedTokenAmount[nodeAddress][reasonCode];
    if (didReasonLogAmount.contains(didAddress)) {
        val = didReasonLogAmount.get(didAddress);
    }

    didReasonLogAmount.set(didAddress, val + ds.NODE_ISSUE_FEE);
    ds._issueTotalAmount[nodeAddress][reasonCode] = ds._issueTotalAmount[nodeAddress][reasonCode] + ds.NODE_ISSUE_FEE;

    emit LoggedNodeIssue(didAddress, nodeAddress, reasonCode);
  }

    /**
    * @dev see { IStorageNodeRegistry }
    */
  function slash(
      address nodeDID,
      uint reasonCode,
      uint amount,
      string calldata moreInfoUrl
  ) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.NodeStorage storage ds = LibStorageNode.nodeStorage();

    if (amount == 0 || amount > ds._stakedTokenAmount[nodeDID]) {
        revert InvalidAmount();
    }

    uint issueAmount = ds._issueTotalAmount[nodeDID][reasonCode];
    if (issueAmount == 0) {
        revert InvalidReasonCode();
    }

    EnumerableMap.AddressToUintMap storage logInfo = ds._loggedTokenAmount[nodeDID][reasonCode];
    uint loggerCount = logInfo.length();
    uint distributeTotalAmount;

    for (uint i; i < loggerCount;) {
        (address didAddress, uint loggerStaked) = logInfo.at(i);
        uint distAmount = amount * loggerStaked / issueAmount;
        distributeTotalAmount += distAmount;

        ds._stakedTokenAmount[didAddress] = ds._stakedTokenAmount[didAddress] + distAmount;

        unchecked { ++i; }
    }

    ds._stakedTokenAmount[nodeDID] = ds._stakedTokenAmount[nodeDID] - distributeTotalAmount;

    emit Slash(nodeDID, reasonCode, distributeTotalAmount, loggerCount, moreInfoUrl);
  }
}
