// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibStorageNode } from "../libraries/LibStorageNode.sol";

interface IStorageNode {
  /**
    * @notice Registers a new endpoint on the network
    * @dev A did can register only one storage-node
    * @param nodeInfo Node information to be added
    * @param requestSignature The request parameters signed by the `didAddress` private key
    * @param requestProof Used to verify request
    * @param authSignature Signature signed by a trusted signer
    */
  function addNode(
      LibStorageNode.StorageNodeInput calldata nodeInfo,
      bytes calldata requestSignature,
      bytes calldata requestProof,
      bytes calldata authSignature
  ) external;

  /**
    * @notice Unregister a storage node from the network at the specified date
    * @param didAddress DID address that is to be removed from the network
    * @param unregisterDateTime The unix timestamp in secods of when the storage node should no logner be available for selection.
      Must be at leaset 28 dayse in the future from calling function point
    * @param requestSignature The request parameters signed by the `didAddress` private key
    * @param requestProof Used to verify request
    */
  function removeNodeStart(
      address didAddress,
      uint unregisterDateTime,
      bytes calldata requestSignature,
      bytes calldata requestProof
  ) external;

  /**
    * @notice Complete storage node unregisteration
    * @param didAddress DID address that is to be removed from the network
    * @param requestSignature The request parameters signed by the `didAddress` private key
    * @param requestProof Used to verify request
    */
  function removeNodeComplete(
      address didAddress,
      bytes calldata requestSignature,
      bytes calldata requestProof
  ) external;

  /**
    * @notice Returns a storage node for didAddress
    * @param didAddress DID address that is associated with the storage node
    * @return StorageNode Returns storage node
    * @return string Status - "active" or "removed"
    */
  function getNodeByAddress(address didAddress) external view returns(LibStorageNode.StorageNode memory, string memory);

  /**
    * @notice Returns a storage node for endpoint uri
    * @param endpointUri The storage node endpoint
    * @return StorageNode Returns storage node
    * @return string Status - "active" or "removed"
    */
  function getNodeByEndpoint(string calldata endpointUri) external view returns(LibStorageNode.StorageNode memory, string memory);

  /**
    * @notice Return an array of `Storagenode` structs for countryCode
    * @param countryCode Unique two-character string code
    * @return StorageNode[] An array of `Storagenode` structs
    */
  function getNodesByCountry(string calldata countryCode) external view returns(LibStorageNode.StorageNode[] memory);

  /**
    * @notice Return an array of `Storagenode` structs for regionCode
    * @param regionCode Unique region string code
    * @return StorageNode[] An array of `Storagenode` structs
    */
  function getNodesByRegion(string calldata regionCode) external view returns(LibStorageNode.StorageNode[] memory);

  /**
    * @notice Returns whether staking is required to call `addNode()` function
    * @return bool The value of required status
    */
  function isStakingRequired() external view returns(bool);

  /**
    * @notice Update the `isStakingRequired` value of `_slotInfo` struct
    * @dev Only the contract owner is allowed to call this function
    * @param isRequired The new value to be updated
    */
  function setStakingRequired(bool isRequired) external;

  /**
    * @notice Returns the `STAKE_PER_SLOT` value of `_slotInfo` struct
    * @return uint Required token amount for one slot
    */
  function getStakePerSlot() external view returns(uint);
  
  /**
    * @notice Update the `STAKE_PER_SLOT` value of `_slotInfo` struct
    * @dev Only the contract owner is allowed to call this function
    * @param newVal The new value to be updated
    */
  function updateStakePerSlot(uint newVal) external;

  /**
    * @notice Return the range of `slotCount` value by pair of minimum and maximum value
    * @dev Return the `MinSlots` and `MaxSlots` value of `_slotInfo` struct
    * @return uint available minimum value of `slotCount`
    * @return uint available maximum value of `slotCount`
    */
  function getSlotCountRange() external view returns(uint, uint);

  /**
    * @notice Update the `MIN_SLOTS` value of `_slotInfo` struct
    * @dev Only the contract owner is allowed to call this function
    * @param minSlots The new value to be updated
    */
  function updateMinSlotCount(uint minSlots) external;

  /**
    * @notice Update the `MAX_SLOTS` value of `_slotInfo` struct
    * @dev Only the contract owner is allowed to call this function
    * @param maxSlots The new value to be updated
    */
  function updateMaxSlotCount(uint maxSlots) external;

  /**
    * @notice Returns the amount of staked token.
    * @dev Will return 0 for unregistered dids
    * @param didAddress DID address that added a storage node
    * @return uint Amount of staked token
    */
  function getBalance(address didAddress) external view returns(uint);

  /**
    * @notice Returns the amount of excess tokens. This happens when the `STAKE_PER_SLOT` value decreased or increased
    * @param didAddress DID address
    * @return int Excess token amount. Can be negative value
    */
  function excessTokenAmount(address didAddress) external view returns(int);

  /**
    * @notice Withdraw amount of tokens to the requestor
    * @dev Will send tokens to the `tx.origin`
    * @param didAddress DID address
    * @param amount Token amount to be withdrawn
    * @param requestSignature The request parameters signed by the `didAddress` private key
    * @param requestProof Used to verify request
    */
  function withdraw(
      address didAddress, 
      uint amount,
      bytes calldata requestSignature,
      bytes calldata requestProof
  ) external;

  /**
    * @notice Depoist verida tokens to the didAddress
    * @dev Work for only the registered DIDs
    * @param didAddress DID address
    * @param tokenAmount Depositing amount of Verida token
    */
  function depositToken(address didAddress, uint tokenAmount) external;

  /**
    * @notice Get current `NODE_ISSUE_FEE`
    * @return uint value of `_slotInfo.NODE_ISSUE_FEE`
    */
  function getNodeIssueFee() external view returns(uint);

  /**
    * @notice Update the `NODE_ISSUE_FEE` in the _slotInfo.
    * @param value New fee value to be set.
    */
  function updateNodeIssueFee(uint value) external;

  /**
    * @notice Return the current token amount staked by logging issues
    * @return uint Amount of VDA tokens for issues
    */
  function getTotalIssueFee() external view returns(uint);

  /**
    * @notice Withdraw the VDA tokens that was deposited by `logNodeIssue()` function
    * @dev Only the contract owner can withdraw fees
    * @param to Receiving address
    * @param amount Amount to be withdrawn
    */
  function withdrawIssueFee(address to, uint amount) external;

  /**
    * @notice Return the current same node log duration
    * @return uint Same node log duration in seconds
    */
  function getSameNodeLogDuration() external view returns(uint);

  /**
    * @notice Update the `SAME_NODE_LOG_DURATION` value
    * @dev Only the contract owner call call this function
    * @param value Time in seconds unit
    */
  function updateSameNodeLogDuration(uint value) external;

  /**
    * @notice Return the current log limit per day
    * @return uint Log limit count per day
    */
  function getLogLimitPerDay() external view returns(uint);

  /**
    * @notice Update the `LOG_LIMIT_PER_DAY` value
    * @dev Only the contract owner call call this function
    * @param value Log limit count per day
    */
  function updateLogLimitPerDay(uint value) external;

  /**
    * @notice Add a reason code
    * @dev Only the contract owner call this function
    * @param reasonCode Node issue reason code to be added
    * @param description Description of the issue
    */
  function addReasonCode(uint reasonCode, string calldata description) external;
  
  /**
    * @notice Disable a reason code
    * @dev Only the contract owner call this function
    * @param reasonCode Node issue reason code to be disabled
    */
  function disableReasonCode(uint reasonCode) external;

  /**
    * @notice Update the description of existing reason code
    * @dev Only the contract owner call this function
    * @param reasonCode Node issue reason code to be updated
    */
  function updateReasonCodeDescription(uint reasonCode, string calldata description) external;

  /**
    * @notice Get the description of existing reason code
    * @dev This function returns the description of disabled reason code too
    * @param reasonCode Node issue reason code
    */
  function getReasonCodeDescription(uint reasonCode) external view returns(string memory);

  /**
    * @notice Return the full list of existing reason codes
    * @return LogReasonCodeOutput[] Array of reason code
    */
  function getReasonCodeList() external view returns(LibStorageNode.LogReasonCodeOutput[] memory);

  /**
    * @notice Log an issue
    * @param didAddress DID who logs this issue
    * @param nodeAddress DIDAddress of the node
    * @param reasonCode reason code of the issue
    * @param requestSignature The request parameters signed by the `didAddress` private key
    * @param requestProof Used to verify request
    */
  function logNodeIssue(
      address didAddress,
      address nodeAddress,
      uint reasonCode,
      bytes calldata requestSignature,
      bytes calldata requestProof
  ) external;

  /**
    * @notice Slash the tokens
    * @dev Only the contract owner can call this
    * @param nodeDID DID address of the node to be slashed
    * @param reasonCode Reascon code to be slashed
    * @param amount Token amount to be slashed
    * @param moreInfoUrl On-chain pointer to where more information can be fournd about this slashing
    */
  function slash(
      address nodeDID,
      uint reasonCode,
      uint amount,
      string calldata moreInfoUrl
  ) external;
}