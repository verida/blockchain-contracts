// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibStorageNode } from "../libraries/LibStorageNode.sol";

interface IStorageNodeLog {
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