/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.6;

import "hardhat/console.sol";
import { VeridaDataVerificationLib } from "./VeridaDataVerificationLib.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/** @title VeridaDIDRegistry */
contract VeridaDIDRegistry is OwnableUpgradeable {

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
    bytes proof;
  }

  struct RevokeAttributeParam{
    bytes32 name;
    bytes value;
  }

  mapping(address => address) public owners;
  mapping(address => mapping(bytes32 => mapping(address => uint))) private delegates;
  mapping(address => uint) public changed;
  mapping(address => uint) private nonce;

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
    bytes proof,
    uint previousChange
  );

  /**
   * @notice Initialize
   */
  function initialize() public initializer {
    __Ownable_init();
  }

  /**
   * Get current nonce of DID
   *@param did - DID registered here
   */
  function getNonce(address did) public view returns(uint) {
    return nonce[did];
  }

  /**
   * @notice Return owner of DID
   * @param identity - DID
   * @return - owner address of DID
   */
  function identityOwner(address identity) public view returns(address) {
     address owner = owners[identity];
     if (owner != address(0x00)) {
       return owner;
     }
     return identity;
  }

  /**
   * @notice Check wheter delegate is valid.
   * @param identity - DID that registered delegate
   * @param delegateType - delegate type in bytes32 format
   * @param delegate - delegate to check
   * @return boolean - result
   */
  function validDelegate(address identity, bytes32 delegateType, address delegate) external view returns(bool) {
    uint validity = delegates[identity][keccak256(abi.encode(delegateType))][delegate];
    return (validity > block.timestamp);  
  }

  /**
   * @notice Change owner of DID
   * @dev Only called after checking the transaction signature
   * @param identity - DID
   * @param newOwner - new owner address
   */
  function _changeOwner(address identity, address newOwner) internal {
    owners[identity] = newOwner;
    emit DIDOwnerChanged(identity, newOwner, changed[identity]);
    changed[identity] = block.number;
  }

  /**
   * @notice Change owner of DID
   * @dev Check transaction signature and call internal function
   * @param identity - DID
   * @param newOwner - new owner address
   * @param signature - transaction signature
   */
  function changeOwner(address identity, address newOwner, bytes calldata signature) external {
    {
      bytes memory unsignedMsg = abi.encodePacked(
        identity,
        newOwner,
        nonce[identity]
      );
      require(VeridaDataVerificationLib.validateSignature(unsignedMsg, signature, identityOwner(identity)), "Invalid Signature");
      nonce[identity]++;
    }
    _changeOwner(identity, newOwner);
  }

  /**
   * @notice Add a delegate to DID
   * @dev Only called after checking the transaction signature
   * @param identity - DID
   * @param delegateType - delegate type in bytes32 format
   * @param delegate - delegate to check
   * @param validity - valid duration of delegate
   */
  function _addDelegate(address identity, bytes32 delegateType, address delegate, uint validity) internal {
    delegates[identity][keccak256(abi.encode(delegateType))][delegate] = block.timestamp + validity;
    emit DIDDelegateChanged(identity, delegateType, delegate, block.timestamp + validity, changed[identity]);
    changed[identity] = block.number;
  }

  /**
   * @notice Add a delegate to DID
   * @dev Check transaction signature and call internal function
   * @param identity - DID
   * @param delegateType - delegate type in bytes32 format
   * @param delegate - delegate to check
   * @param validity - valid duration of delegate
   * @param signature - transaction signature
   */
  function addDelegate(address identity, bytes32 delegateType, address delegate, uint validity, bytes calldata signature) external {
    {
      bytes memory unsignedMsg = abi.encodePacked(
        identity,
        delegateType,
        delegate,
        validity,
        nonce[identity]
      );
      address owner = identityOwner(identity);
      require(VeridaDataVerificationLib.validateSignature(unsignedMsg, signature, owner), "Invalid Signature");
      nonce[identity]++;
    }
    _addDelegate(identity, delegateType, delegate, validity);
  }

  /**
   * @notice Revoke a delegate from DID
   * @dev Only called after checking the transaction signature
   * @param identity - DID
   * @param delegateType - delegate type in bytes32 format
   * @param delegate - delegate to check
   */
  function _revokeDelegate(address identity, bytes32 delegateType, address delegate) internal {
    delegates[identity][keccak256(abi.encode(delegateType))][delegate] = block.timestamp;
    emit DIDDelegateChanged(identity, delegateType, delegate, block.timestamp, changed[identity]);
    changed[identity] = block.number;
  }

  /**
   * @notice Revoke a delegate to DID
   * @dev Check transaction signature and call internal function
   * @param identity - DID
   * @param delegateType - delegate type in bytes32 format
   * @param delegate - delegate to check
   * @param signature - transaction signature
   */
  function revokeDelegate(address identity, bytes32 delegateType, address delegate, bytes calldata signature) external {
    {
      bytes memory unsignedMsg = abi.encodePacked(
        identity,
        delegateType,
        delegate,
        nonce[identity]
      );
      address owner = identityOwner(identity);
      require(VeridaDataVerificationLib.validateSignature(unsignedMsg, signature, owner), "Invalid Signature");
      nonce[identity]++;
    }
    _revokeDelegate(identity, delegateType, delegate);
  }

  /**
   * @notice Set an attribute to DID
   * @dev Only called after checking the transaction signature
   * @param identity - DID
   * @param name - attribute name in bytes32 format
   * @param value - attribute value
   * @param validity - valid duration of attribute
   */
  function _setAttribute(address identity, bytes32 name, bytes calldata value, uint validity, bytes calldata proof) internal {
    uint previousChange = changed[identity];
    emit DIDAttributeChanged(identity, name, value, block.timestamp + validity, proof, previousChange);
    changed[identity] = block.number;
  }

  /**
   * @notice Set an attribute to DID
   * @dev Check transaction signature and call internal function
   * @param identity - DID
   * @param name - attribute name in bytes32 format
   * @param value - attribute value
   * @param validity - valid duration of attribute
   * @param signature - transaction signature
   * @param proof - proof
   */
  function setAttribute(
    address identity, 
    bytes32 name, 
    bytes calldata value, 
    uint validity,
    bytes calldata proof,
    bytes calldata signature
    ) external {
    {
      uint didNonce = nonce[identity];
      bytes memory unsignedMsg = abi.encodePacked(
        identity,
        name,
        value,
        validity,
        proof,
        didNonce
      );
      address owner = identityOwner(identity);
      require(VeridaDataVerificationLib.validateSignature(unsignedMsg, signature, owner), "Invalid Signature");
      nonce[identity]++;
    }
    
    _setAttribute(identity, name, value, validity, proof);
  }

  /**
   * @notice Revoke an attribute from DID
   * @dev Only called after checking the transaction signature
   * @param identity - DID
   * @param name - attribute name in bytes32 format
   * @param value - attribute value
   */
  function _revokeAttribute(address identity, bytes32 name, bytes calldata value) internal {
    emit DIDAttributeChanged(identity, name, value, 0, new bytes(0), changed[identity]);
    changed[identity] = block.number;
  }

  /**
   * @notice Revoke an attribute from DID
   * @dev Check transaction signature and call internal function
   * @param identity - DID
   * @param name - attribute name in bytes32 format
   * @param value - attribute value
   * @param signature - transaction signature
   */
  function revokeAttribute(address identity, bytes32 name, bytes calldata value, bytes calldata signature ) external {
    {
      bytes memory unsignedMsg = abi.encodePacked(
        identity,
        name,
        value,
        nonce[identity]
      );
      address owner = identityOwner(identity);
      require(VeridaDataVerificationLib.validateSignature(unsignedMsg, signature, owner), "Invalid Signature");
      nonce[identity]++;
    }
    _revokeAttribute(identity, name, value);
  }

  /**
   * @notice Perform 'add' operations of multiple delegates & attributes
   * @dev Only called after checking the transaction signature
   * @param identity - DID
   * @param delegateParams - array of delegates to be added
   * @param attributeParams - array of attributes to be added
   */
  function _bulkAdd(
    address identity,
    DelegateParam[] calldata delegateParams,
    AttributeParam[] calldata attributeParams
  ) internal {
    for (uint i = 0; i < delegateParams.length; i++) {
      _addDelegate(
        identity, 
        delegateParams[i].delegateType,
        delegateParams[i].delegate,
        delegateParams[i].validity);
    }

    for (uint i = 0; i < attributeParams.length; i++) {
      _setAttribute(
        identity, 
        attributeParams[i].name,
        attributeParams[i].value,
        attributeParams[i].validity,
        attributeParams[i].proof);
    }
  }

  /**
   * @notice Perform 'add' operations of multiple delegates & attributes
   * @dev Check transaction signature and call internal function
   * @param identity - DID
   * @param delegateParams - array of delegates to be added
   * @param attributeParams - array of attributes to be added
   * @param signature - transaction signature
   */
  function bulkAdd(
    address identity,
    DelegateParam[] calldata delegateParams,
    AttributeParam[] calldata attributeParams,
    bytes calldata signature
  ) external {
    {
      bytes memory unsignedMsg = abi.encodePacked(identity);
      for (uint i = 0; i < delegateParams.length; i++) {
        unsignedMsg = abi.encodePacked(
          unsignedMsg,
          delegateParams[i].delegateType,
          delegateParams[i].delegate,
          delegateParams[i].validity
        );
      }

      for (uint i = 0; i < attributeParams.length; i++) {
        unsignedMsg = abi.encodePacked(
          unsignedMsg,
          attributeParams[i].name,
          attributeParams[i].value,
          attributeParams[i].validity,
          attributeParams[i].proof
        );
      }
      unsignedMsg = abi.encodePacked(unsignedMsg, nonce[identity]);
      require(VeridaDataVerificationLib.validateSignature(unsignedMsg, signature, identityOwner(identity)), "Invalid Signature");
      nonce[identity]++;
    }
    _bulkAdd(identity, delegateParams, attributeParams);
  }

  /**
   * @notice Perform 'revoke' operations of multiple delegates & attributes
   * @dev Only called after checking the transaction signature
   * @param identity - DID
   * @param delegateParams - array of delegates to be added
   * @param attributeParams - array of attributes to be added
   */
  function _bulkRevoke(
    address identity,
    RevokeDelegateParam[] calldata delegateParams,
    RevokeAttributeParam[] calldata attributeParams
  ) internal {
    for (uint i = 0; i < delegateParams.length; i++) {
      _revokeDelegate(identity, delegateParams[i].delegateType, delegateParams[i].delegate);
    }

    for (uint i = 0; i < attributeParams.length; i++) {
      _revokeAttribute(identity, attributeParams[i].name, attributeParams[i].value);
    }
  }

  /**
   * @notice Perform 'revoke' operations of multiple delegates & attributes
   * @dev Check transaction signature and call internal function
   * @param identity - DID
   * @param delegateParams - array of delegates to be added
   * @param attributeParams - array of attributes to be added
   * @param signature - transaction signature
   */
  function bulkRevoke(
    address identity,
    RevokeDelegateParam[] calldata delegateParams,
    RevokeAttributeParam[] calldata attributeParams,
    bytes calldata signature
  ) external {
    {
      bytes memory unsignedMsg = abi.encodePacked(identity);
      for (uint i = 0; i < delegateParams.length; i++) {
        unsignedMsg = abi.encodePacked(
          unsignedMsg,
          delegateParams[i].delegateType,
          delegateParams[i].delegate
        );
      }

      for (uint i = 0; i < attributeParams.length; i++) {
        unsignedMsg = abi.encodePacked(
          unsignedMsg,
          attributeParams[i].name,
          attributeParams[i].value
        );
      }
      unsignedMsg = abi.encodePacked(unsignedMsg, nonce[identity]);
      require(VeridaDataVerificationLib.validateSignature(unsignedMsg, signature, identityOwner(identity)), "Invalid Signature");
      nonce[identity]++;
    }
    _bulkRevoke(identity, delegateParams, attributeParams);
  }
}
