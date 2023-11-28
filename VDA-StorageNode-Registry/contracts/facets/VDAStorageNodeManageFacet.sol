// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibStorageNode } from "../libraries/LibStorageNode.sol";
import { LibVerification } from "../libraries/LibVerification.sol";
import { IStorageNodeManage } from "../interfaces/IStorageNodeManage.sol"; 

error InvalidDIDAddress();
error InvalidEndpointUri();
error InvalidSlotCount();
error InvalidUnregisterTime();

contract VDAStorageNodeManageFacet is IStorageNodeManage {
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
}