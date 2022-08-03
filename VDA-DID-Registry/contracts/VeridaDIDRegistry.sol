/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.6;

// import "hardhat/console.sol";
import "./BytesLib.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/** @title VeridaDIDRegistry */
contract VeridaDIDRegistry is OwnableUpgradeable {

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

  /**
   * @notice Check validity of transaction
   * @dev Only used for non-view functions
   * @param identity - DID
   * @param signature - transaction signature
   */
  modifier onlyVerifiedSignature(address identity, bytes calldata signature) {
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

  /**
   * @notice Initialize
   */
  function initialize() public initializer {
    __Ownable_init();
  }

  /**
   * @notice Return owner of DID
   * @param identity - DID
   * @return - owner address of DID
   */
  function identityOwner(address identity) external view returns(address) {
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
  function changeOwner(address identity, address newOwner) internal {
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
  function changeOwner(address identity, address newOwner, bytes calldata signature) external onlyVerifiedSignature(identity, signature) {
    changeOwner(identity, newOwner);
  }

  /**
   * @notice Add a delegate to DID
   * @dev Only called after checking the transaction signature
   * @param identity - DID
   * @param delegateType - delegate type in bytes32 format
   * @param delegate - delegate to check
   * @param validity - valid duration of delegate
   */
  function addDelegate(address identity, bytes32 delegateType, address delegate, uint validity) internal {
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
  function addDelegate(address identity, bytes32 delegateType, address delegate, uint validity, bytes calldata signature) external onlyVerifiedSignature(identity, signature) {
    addDelegate(identity, delegateType, delegate, validity);
  }

  /**
   * @notice Revoke a delegate from DID
   * @dev Only called after checking the transaction signature
   * @param identity - DID
   * @param delegateType - delegate type in bytes32 format
   * @param delegate - delegate to check
   */
  function revokeDelegate(address identity, bytes32 delegateType, address delegate) internal {
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
  function revokeDelegate(address identity, bytes32 delegateType, address delegate, bytes calldata signature) external onlyVerifiedSignature(identity, signature) {
    revokeDelegate(identity, delegateType, delegate);
  }

  /**
   * @notice Set an attribute to DID
   * @dev Only called after checking the transaction signature
   * @param identity - DID
   * @param name - attribute name in bytes32 format
   * @param value - attribute value
   * @param validity - valid duration of attribute
   */
  function setAttribute(address identity, bytes32 name, bytes memory value, uint validity) internal {
    emit DIDAttributeChanged(identity, name, value, block.timestamp + validity, changed[identity]);
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
   */
  function setAttribute(address identity, bytes32 name, bytes memory value, uint validity, bytes calldata signature ) external onlyVerifiedSignature(identity, signature) {
    setAttribute(identity, name, value, validity);
  }

  /**
   * @notice Revoke an attribute from DID
   * @dev Only called after checking the transaction signature
   * @param identity - DID
   * @param name - attribute name in bytes32 format
   * @param value - attribute value
   */
  function revokeAttribute(address identity, bytes32 name, bytes memory value) internal {
    emit DIDAttributeChanged(identity, name, value, 0, changed[identity]);
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
  function revokeAttribute(address identity, bytes32 name, bytes memory value, bytes calldata signature ) external onlyVerifiedSignature(identity, signature) {
    revokeAttribute(identity, name, value);
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
  ) external onlyVerifiedSignature(identity, signature) {
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
    RevokeDelegateParam[] memory delegateParams,
    RevokeAttributeParam[] memory attributeParams,
    bytes calldata signature
  ) external onlyVerifiedSignature(identity, signature) {
    _bulkRevoke(identity, delegateParams, attributeParams);
  }
}
