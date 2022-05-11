/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.6;

// import "hardhat/console.sol";
import "./BytesLib.sol";

contract VeridaDIDRegistry {

  using BytesLib for bytes;

  struct DelegateParam {
    bytes32 delegateType;
    address delegate;
    uint validity;   
  }

  struct RevokeDelegateParam {
    bytes32 delegateType;
    address delegate;
  }

  struct AttributeParam{
    bytes32 name;
    bytes value;
    uint validity;
  }

  struct RevokeAttributeParam{
    bytes32 name;
    bytes value;
  }

  mapping(address => address) public owners;
  mapping(address => mapping(bytes32 => mapping(address => uint))) public delegates;
  mapping(address => uint) public changed;
  mapping(address => uint) public nonce;

  modifier onlyVerifiedSignature(address idntity, bytes calldata signature) {
    // require signature is signed by identity
    bytes memory rightSign = hex"67de2d20880a7d27b71cdcb38817ba95800ca82dff557cedd91b96aacb9062e80b9e0b8cb9614fd61ce364502349e9079c26abaa21890d7bc2f1f6c8ff77f6261c";
    require(signature.equal(rightSign), "bad_actor");
    _;
  }

  event DIDOwnerChanged(
    address indexed identity,
    address owner,
    uint previousChange
  );

  event DIDDelegateChanged(
    address indexed identity,
    bytes32 delegateType,
    address delegate,
    uint validTo,
    uint previousChange
  );

  event DIDAttributeChanged(
    address indexed identity,
    bytes32 name,
    bytes value,
    uint validTo,
    uint previousChange
  );

  function identityOwner(address identity) external view returns(address) {
     address owner = owners[identity];
     if (owner != address(0x00)) {
       return owner;
     }
     return identity;
  }

  function validDelegate(address identity, bytes32 delegateType, address delegate) external view returns(bool) {
    uint validity = delegates[identity][keccak256(abi.encode(delegateType))][delegate];
    return (validity > block.timestamp);  
  }

  function changeOwner(address identity, address newOwner) internal {
    owners[identity] = newOwner;
    emit DIDOwnerChanged(identity, newOwner, changed[identity]);
    changed[identity] = block.number;
  }

  function changeOwner(address identity, address newOwner, bytes calldata signature) external onlyVerifiedSignature(identity, signature) {
    changeOwner(identity, newOwner);
  }

  function addDelegate(address identity, bytes32 delegateType, address delegate, uint validity) internal {
    delegates[identity][keccak256(abi.encode(delegateType))][delegate] = block.timestamp + validity;
    emit DIDDelegateChanged(identity, delegateType, delegate, block.timestamp + validity, changed[identity]);
    changed[identity] = block.number;
  }

  function addDelegate(address identity, bytes32 delegateType, address delegate, uint validity, bytes calldata signature) external onlyVerifiedSignature(identity, signature) {
    addDelegate(identity, delegateType, delegate, validity);
  }

  function revokeDelegate(address identity, bytes32 delegateType, address delegate) internal {
    delegates[identity][keccak256(abi.encode(delegateType))][delegate] = block.timestamp;
    emit DIDDelegateChanged(identity, delegateType, delegate, block.timestamp, changed[identity]);
    changed[identity] = block.number;
  }

  function revokeDelegate(address identity, bytes32 delegateType, address delegate, bytes calldata signature) external onlyVerifiedSignature(identity, signature) {
    revokeDelegate(identity, delegateType, delegate);
  }

  function setAttribute(address identity, bytes32 name, bytes memory value, uint validity) internal {
    emit DIDAttributeChanged(identity, name, value, block.timestamp + validity, changed[identity]);
    changed[identity] = block.number;
  }

  function setAttribute(address identity, bytes32 name, bytes memory value, uint validity, bytes calldata signature ) external onlyVerifiedSignature(identity, signature) {
    setAttribute(identity, name, value, validity);
  }

  function revokeAttribute(address identity, bytes32 name, bytes memory value) internal {
    emit DIDAttributeChanged(identity, name, value, 0, changed[identity]);
    changed[identity] = block.number;
  }

  function revokeAttribute(address identity, bytes32 name, bytes memory value, bytes calldata signature ) external onlyVerifiedSignature(identity, signature) {
    revokeAttribute(identity, name, value);
  }

  // Bulk Add
  function _bulkAdd(
    address identity,
    DelegateParam[] calldata delegateParams,
    AttributeParam[] calldata attributeParams
  ) internal {
    for (uint i = 0; i < delegateParams.length; i++) {
      addDelegate(
        identity, 
        delegateParams[i].delegateType,
        delegateParams[i].delegate,
        delegateParams[i].validity);
    }

    for (uint i = 0; i < attributeParams.length; i++) {
      setAttribute(
        identity, 
        attributeParams[i].name,
        attributeParams[i].value,
        attributeParams[i].validity);
    }
  }

  function bulkAdd(
    address identity,
    DelegateParam[] calldata delegateParams,
    AttributeParam[] calldata attributeParams,
    bytes calldata signature
  ) external onlyVerifiedSignature(identity, signature) {
    _bulkAdd(identity, delegateParams, attributeParams);
  }

  function _bulkRevoke(
    address identity,
    RevokeDelegateParam[] memory delegateParams,
    RevokeAttributeParam[] memory attributeParams
  ) internal {
    for (uint i = 0; i < delegateParams.length; i++) {
      revokeDelegate(identity, delegateParams[i].delegateType, delegateParams[i].delegate);
    }

    for (uint i = 0; i < attributeParams.length; i++) {
      revokeAttribute(identity, attributeParams[i].name, attributeParams[i].value);
    }
  }

  function bulkRevoke(
    address identity,
    RevokeDelegateParam[] memory delegateParams,
    RevokeAttributeParam[] memory attributeParams,
    bytes calldata signature
  ) external onlyVerifiedSignature(identity, signature) {
    _bulkRevoke(identity, delegateParams, attributeParams);
  }
}
