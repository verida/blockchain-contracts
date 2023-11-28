// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibStorageNode } from "../libraries/LibStorageNode.sol";
import { LibVerification } from "../libraries/LibVerification.sol";
import { IStorageNodeLog } from "../interfaces/IStorageNodeLog.sol"; 

error InvalidDIDAddress();
error InvalidEndpointUri();
error InvalidSlotCount();
error InvalidUnregisterTime();

contract VDAStorageNodeLogFacet is IStorageNodeLog {
  /**
    * @dev see { IStorageNodeRegistry }
    */
  function getNodeIssueFee() external view virtual override returns(uint){
      return LibStorageNode.getNodeIssueFee();
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function updateNodeIssueFee(uint value) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.updateNodeIssueFee(value);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function getTotalIssueFee() external view virtual override returns(uint) {
    return LibStorageNode.getTotalIssueFee();
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function withdrawIssueFee(address to, uint amount) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.withdrawIssueFee(to, amount);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function getSameNodeLogDuration() external view virtual override returns(uint) {
      return LibStorageNode.getSameNodeLogDuration();
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function updateSameNodeLogDuration(uint value) external virtual override {
      LibDiamond.enforceIsContractOwner();
      LibStorageNode.updateSameNodeLogDuration(value);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function getLogLimitPerDay() external view virtual override returns(uint) {
      return LibStorageNode.getLogLimitPerDay();
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function updateLogLimitPerDay(uint value) external virtual override {
      LibDiamond.enforceIsContractOwner();
      LibStorageNode.updateLogLimitPerDay(value);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function addReasonCode(uint reasonCode, string calldata description) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.addReasonCode(reasonCode, description);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function disableReasonCode(uint reasonCode) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.disableReasonCode(reasonCode);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function updateReasonCodeDescription(uint reasonCode, string calldata description) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.updateReasonCodeDescription(reasonCode, description);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function getReasonCodeDescription(uint reasonCode) external view virtual override returns(string memory) {
    return LibStorageNode.getReasonCodeDescription(reasonCode);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function getReasonCodeList() external view virtual override returns(LibStorageNode.LogReasonCodeOutput[] memory) {
    return LibStorageNode.getReasonCodeList();
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
    bytes memory params = abi.encodePacked(didAddress, nodeAddress, reasonCode);
    LibVerification.verifyRequest(didAddress, params, requestSignature, requestProof);
    
    LibStorageNode.logNodeIssue(didAddress, nodeAddress, reasonCode);
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
    LibStorageNode.slash(nodeDID, reasonCode, amount, moreInfoUrl);
  }
}
