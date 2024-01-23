// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibStorageNode } from "../libraries/LibStorageNode.sol";

interface IStorageNode {

  /**
    * @notice Output of Reasoncode
    * @dev Return type of `getReasonCodeList()` function
    * @param reasonCode Reason code
    * @param description description of reason code
    */
  struct LogReasonCodeOutput {
      uint reasonCode;
      string description;
  }

  /**
    * @notice Emitted when the `isStakingRequired` value is updated
    * @param newVal New value updated
    */
  event UpdateStakingRequired(bool newVal);

  /**
    * @notice Emitted when the `isWithdrawalEnabled` value is updated
    * @param newVal New value updated
    */
  event UpdateWithdrawalEnabled(bool newVal);

  /**
    * @notice Emitted when the `STAKE_PER_SLOT` value is updated
    * @param newVal New value updated
    */
  event UpdateStakePerSlot(uint newVal);

  /**
    * @notice Emitted when the `MIN_SLOTS` value is updated
    * @param newVal New value updated
    */
  event UpdateMinSlotCount(uint newVal);

  /**
    * @notice Emitted when the `MAX_SLOTS` value is updated
    * @param newVal New value updated
    */
  event UpdateMaxSlotCount(uint newVal);

  /**
    * @notice Emitted when the excess tokens are withdrawn
    * @param didAddress DID address
    * @param to Token receiving address
    * @param amount Withdrawn amount
    */
  event TokenWithdrawn(address indexed didAddress, address to, uint amount);

  /**
    * @notice Emitted when the tokens are deposited
    * @param didAddress DID address
    * @param from Wallet address from which tokens are deposited
    * @param amount Deposited amount
    */
  event TokenDeposited(address indexed didAddress, address from, uint amount);

  /**
    * @notice Emitted when the NODE_ISSUE_FEE updated
    * @param orgFee Original fee value
    * @param newFee Updated fee value
    */
  event UpdateNodeIssueFee(uint orgFee, uint newFee);

  /**
    * @notice Emitted when the SAME_NODE_LOG_DURATION updated
    * @param orgVal Original value
    * @param newVal Updated value
    */
  event UpdateSameNodeLogDuration(uint orgVal, uint newVal);

  /**
    * @notice Emitted when the LOG_LIMIT_PER_DAY updated
    * @param orgVal Original value
    * @param newVal Updated value
    */
  event UpdateLogLimitPerDay(uint orgVal, uint newVal);

  /**
    * @notice Emitted when a reason code is added
    * @param reasonCode Code that is newly added
    * @param description Description of added reason code
    */
  event AddReasonCode(uint indexed reasonCode, string description);

  /**
    * @notice Emitted when a reason code is disabled
    * @param reasonCode Code that is disabled
    */
  event DisableReasonCode(uint indexed reasonCode);

  /**
    * @notice Emitted when the description of a reason code is updated
    * @param reasonCode Code that is updated
    * @param from Original description
    * @param to Updated description
    */
  event UpdateReasonCodeDescription(uint indexed reasonCode, string from, string to);

  /**
    * @notice Emitted when user logged an node issue by `logNodeIssue()` function
    * @param from DID address that logs this issue
    * @param nodeDID DID address of the node
    * @param reasonCode Reason code
    */
  event LoggedNodeIssue(address indexed from, address nodeDID, uint reasonCode);

  /**
    * @notice Emitted when stakes VDA tokens of `nodeDID` was slashed by contract owner
    * @param nodeDID DID address of the node
    * @param reasonCode Reason code
    * @param Amount Slashed amount. This can be a bit different from the parameter of `slash()` function
    * @param rewardedCount Number of dids who received the rewards
    * @param moreInfoUrl On-chain pointer to where more information can be fournd about this slashing
    */
  event Slash(address indexed nodeDID, uint reasonCode, uint Amount, uint rewardedCount, string moreInfoUrl);

  /**
    * @notice Emitted when the contract owner withdraw tokens staked by logging issues
    * @param to Receiver address
    * @param amount Token amount to be withdrawn
    */
  event WithdrawIssueFee(address indexed to, uint amount);

  /**
   * @notice Return `DECIMAL` - Denominator for latitude and logitude values
   * @return uint8 Decimal value
   */
  function DECIMAL() external pure returns(uint8);

  /**
   * @notice Return the Verida token address that is associated with this contract
   * @return address Verida token address
   */
  function getVDATokenAddress() external view returns(address);

  /**
    * @notice Returns whether staking is required to call `addNode()` function
    * @return bool The value of required status
    */
  function isStakingRequired() external view returns(bool);

  /**
    * @notice Update the `isStakingRequired` value of StorageNode - LibStorageNode.nodeStorage()
    * @dev Only the contract owner is allowed to call this function
    * @param isRequired The new value to be updated
    */
  function setStakingRequired(bool isRequired) external;

  /**
   * @notice Returns whether withdrawal is enabled for users
   * @return bool true if enabled, otherwise false
   */
  function isWithdrawalEnabled() external view returns(bool);

  /**
   * @notice Update the `isWithdrawalEnabled` value of StorageNode - LibStorageNode.nodeStorage()
   * @dev Only the contract owner is allowed to call this function
   * @param isEnabled The new value to be updated
   */
  function setWithdrawalEnabled(bool isEnabled) external;

  /**
    * @notice Returns the `STAKE_PER_SLOT` value of StorageNode - LibStorageNode.nodeStorage()
    * @return uint Required token amount for one slot
    */
  function getStakePerSlot() external view returns(uint);
  
  /**
    * @notice Update the `STAKE_PER_SLOT` value of StorageNode - LibStorageNode.nodeStorage()
    * @dev Only the contract owner is allowed to call this function
    * @param newVal The new value to be updated
    */
  function updateStakePerSlot(uint newVal) external;

  /**
    * @notice Return the range of `slotCount` value by pair of minimum and maximum value
    * @dev Return the `MinSlots` and `MaxSlots` value of StorageNode - LibStorageNode.nodeStorage()
    * @return uint available minimum value of `slotCount`
    * @return uint available maximum value of `slotCount`
    */
  function getSlotCountRange() external view returns(uint, uint);

  /**
    * @notice Update the `MIN_SLOTS` value of StorageNode - LibStorageNode.nodeStorage()
    * @dev Only the contract owner is allowed to call this function
    * @param minSlots The new value to be updated
    */
  function updateMinSlotCount(uint minSlots) external;

  /**
    * @notice Update the `MAX_SLOTS` value of StorageNode - LibStorageNode.nodeStorage()
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
    * @param didAddress DID address from which staked tokens to be withdrawn
    * @param to Recipient address that receives withdrawn tokens
    * @param amount Token amount to be withdrawn
    * @param requestSignature The request parameters signed by the `didAddress` private key
    * @param requestProof Used to verify request
    */
  function withdraw(
      address didAddress, 
      address to,
      uint amount,
      bytes calldata requestSignature,
      bytes calldata requestProof
  ) external;

  /**
    * @notice Depoist verida tokens from transaction creator(tx.origin) to the didAddress
    * @dev Work for only the registered DIDs
    * @param didAddress DID address
    * @param tokenAmount Depositing amount of Verida token
    */
  function depositToken(address didAddress, uint tokenAmount) external;

  /**
    * @notice Depoist verida tokens from specified address(`from` parameter) to the didAddress
    * @dev Work for only the registered DIDs
    * @param didAddress DID address
    * @param from Smart contract or EOA address that provide the deposited token
    * @param tokenAmount Depositing amount of Verida token
    */
  function depositTokenFromProvider(address didAddress, address from, uint tokenAmount) external;

  
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
  function getReasonCodeList() external view returns(LogReasonCodeOutput[] memory);

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