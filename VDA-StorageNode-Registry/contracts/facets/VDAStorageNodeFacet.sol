// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibStorageNode } from "../libraries/LibStorageNode.sol";
import { LibVerification } from "../libraries/LibVerification.sol";
import { IStorageNode } from "../interfaces/IStorageNode.sol"; 

error InvalidDIDAddress();
error InvalidEndpointUri();
error InvalidSlotCount();
error InvalidUnregisterTime();

contract VDAStorageNodeFacet is IStorageNode {
  /**
    * @dev see { IStorageNodeRegistry }
    */
  function addNode(
      LibStorageNode.StorageNodeInput calldata nodeInfo,
      bytes calldata requestSignature,
      bytes calldata requestProof,
      bytes calldata authSignature
  ) external virtual override {
    {
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
    
    LibStorageNode.addNode(nodeInfo);
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
    bytes memory params = abi.encodePacked(didAddress, unregisterDateTime);
    LibVerification.verifyRequest(didAddress, params, requestSignature, requestProof);
    LibStorageNode.removeNodeStart(didAddress, unregisterDateTime);
  }
  
  /**
    * @dev see { IStorageNodeRegistry }
    */
  function removeNodeComplete(
      address didAddress,
      bytes calldata requestSignature,
      bytes calldata requestProof
  ) external virtual override {

    bytes memory params = abi.encodePacked(didAddress);
    LibVerification.verifyRequest(didAddress, params, requestSignature, requestProof);
    
    LibStorageNode.removeNodeComplete(didAddress);
  }

  /**
    * @dev see { IStorageNode }
    */
  function getNodeByAddress(address didAddress) external view virtual override returns(LibStorageNode.StorageNode memory, string memory) {
      return LibStorageNode.getNodeByAddress(didAddress);
  }

  /**
    * @dev see { IStorageNode }
    */
  function getNodeByEndpoint(string calldata endpointUri) external view virtual override returns(LibStorageNode.StorageNode memory, string memory) {
      return LibStorageNode.getNodeByEndpoint(endpointUri);
  }

  /**
    * @dev see { IStorageNode }
    */
  function getNodesByCountry(string calldata countryCode) external view virtual override returns(LibStorageNode.StorageNode[] memory) {
    return LibStorageNode.getNodesByCountry(countryCode);
  }

  /**
    * @dev see { IStorageNode }
    */
  function getNodesByRegion(string calldata regionCode) external view virtual override returns(LibStorageNode.StorageNode[] memory) {
      return LibStorageNode.getNodesByRegion(regionCode);
  }

  /**
    * @dev see { IStorageNode }
    */
  function isStakingRequired() external view virtual override returns(bool) {
      return LibStorageNode.isStakingRequired();
  }

  /**
    * @dev see { IStorageNode }
    */
  function setStakingRequired(bool isRequired) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.setStakingRequired(isRequired);
  }

  /**
    * @dev see { IStorageNode }
    */
  function getStakePerSlot() external view virtual override returns(uint) {
      return LibStorageNode.getStakePerSlot();
  }

  /**
    * @dev see { IStorageNode }
    */
  function updateStakePerSlot(uint newVal) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.updateStakePerSlot(newVal);
  }

  /**
    * @dev see { IStorageNode }
    */
  function getSlotCountRange() external view virtual override returns(uint, uint) {
    return LibStorageNode.getSlotCountRange();
  }

  /**
    * @dev see { IStorageNode }
    */
  function updateMinSlotCount(uint minSlots) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.updateMinSlotCount(minSlots);
  }

  /**
    * @dev see { IStorageNode }
    */
  function updateMaxSlotCount(uint maxSlots) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibStorageNode.updateMaxSlotCount(maxSlots);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function getBalance(address didAddress) external view virtual override returns(uint) {
      return LibStorageNode.getBalance(didAddress);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function excessTokenAmount(address didAddress) external view virtual override returns(int) {
      return LibStorageNode.getExcessTokenAmount(didAddress);
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

    LibStorageNode.withdraw(didAddress, amount);
  }

  /**
    * @dev see { IStorageNodeRegistry }
    */
  function depositToken(address didAddress, uint tokenAmount) external virtual override {
      LibStorageNode.depositToken(didAddress, tokenAmount);
  }

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
