/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.18;

import { VeridaDataVerificationLib } from "./VeridaDataVerificationLib.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

// Verida contract dependencies
import { EnumerableSet } from "@verida/common-contract/contracts/EnumerableSet.sol";
import "./IVeridaDIDRegistry.sol";

// import "hardhat/console.sol";

/** @title VeridaDIDRegistry */
contract VeridaDIDRegistry is OwnableUpgradeable, IVeridaDIDRegistry {

  using EnumerableSet for EnumerableSet.StringSet;
  using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

  /**
   * @notice List of registered DIDs
   */
  EnumerableSetUpgradeable.AddressSet internal _registeredDIDs;

  /**
   * @notice Map of registered DID info
   * @dev DID address => DIDInfo
   */
  mapping(address => DIDInfo) internal _DIDInfo;

  /**
   * @notice Next nonce of DID
   * @dev DID address => nonce
   */
  mapping(address => uint) internal _nonce;

  /**
     * @notice Gap for later use
     */
  uint256[20] private __gap;

  /**
   * @notice Struct representing the DID info
   */
  struct DIDInfo {
    address controller;
    EnumerableSet.StringSet endpoints;
  }

  // Custom errors
  error RevokedDID();
  error InvalidSignature();
  error UnregisteredDID();
  error OutOfRange();

  /**
   * @notice Initialize
   */
  function initialize() public initializer {
    __Ownable_init();
  }

  /**
   * @notice Internal function to check a DID is registered
   * @dev Revoked DIDs are not registered ones
   */
  function _isRegistered(address didAddress) internal view virtual returns(bool) {
    return _registeredDIDs.contains(didAddress);
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function isRegistered(address didAddress) external view virtual override returns(bool) {
    return _isRegistered(didAddress);
  }
  
  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function register(address didAddress, string[] calldata endpoints, bytes calldata signature ) external virtual override {
    if (_nonce[didAddress] != 0 && !_isRegistered(didAddress)) {
      revert RevokedDID();
    }

    {
      bytes memory rawMsg = abi.encodePacked(didAddress, "/");
      for (uint i; i < endpoints.length;) {
        rawMsg = abi.encodePacked(rawMsg, endpoints[i], "/");
        unchecked { ++i; }
      }

      rawMsg = abi.encodePacked(rawMsg, _nonce[didAddress]);

      if (!VeridaDataVerificationLib.validateSignature(rawMsg, signature, didAddress)) {
        revert InvalidSignature();
      }
      _nonce[didAddress]++;
    }

    EnumerableSet.StringSet storage list = _DIDInfo[didAddress].endpoints;
    list.clear();
    
    for (uint i; i < endpoints.length;) {
      list.add(endpoints[i]);
      unchecked { ++i; }
    }

    // Add didAddress for only new registers
    if (!_isRegistered(didAddress)) {
      _registeredDIDs.add(didAddress);
    }

    emit Register(didAddress, endpoints);
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function revoke(address didAddress, bytes calldata signature) external virtual override {
    if (!_isRegistered(didAddress)) {
      revert UnregisteredDID();
    }
    {
      address controller = _getController(didAddress);
      bytes memory rawMsg = abi.encodePacked(
        didAddress, 
        "/revoke/",
        _nonce[didAddress]);
      
      if (!VeridaDataVerificationLib.validateSignature(rawMsg, signature, controller)) {
        revert InvalidSignature();
      }
      _nonce[didAddress]++;
    }

    delete _DIDInfo[didAddress];
    _registeredDIDs.remove(didAddress);

    emit Revoke(didAddress);
  }

  /**
   * @notice Internal function to get a controller of DID address
   * @dev This is internal function to be used in another functions. Gas efficient than external function
   * @param didAddress DID address
   * @return result Controller of DID address
   */
  function _getController(address didAddress) internal virtual view returns(address result) {
    result = _DIDInfo[didAddress].controller;
    assembly {
      if iszero(result) {
        result := didAddress
      }
    }
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function getController(address didAddress) external virtual view override returns(address) {
    return _getController(didAddress);
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function setController(address didAddress, address controller, bytes calldata signature) external virtual override {
    if (!_isRegistered(didAddress)) {
      revert UnregisteredDID();
    }
    {
      address oldController = _getController(didAddress);
      bytes memory rawMsg = abi.encodePacked(
        didAddress, 
        "/setController/",
        controller,
        "/",
        _nonce[didAddress]);
      
      if (!VeridaDataVerificationLib.validateSignature(rawMsg, signature, oldController)) {
        revert InvalidSignature();
      }
      _nonce[didAddress]++;
    }

    _DIDInfo[didAddress].controller = controller;

    emit SetController(didAddress, controller);
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function lookup(address didAddress) external view virtual override returns(address, string[] memory) {
    if (!_isRegistered(didAddress)) {
      revert UnregisteredDID();
    }

    EnumerableSet.StringSet storage list = _DIDInfo[didAddress].endpoints;
    uint length = list.length();

    string[] memory ret = new string[](length);

    for (uint i; i < length;) {
      ret[i] = list.at(i);
      unchecked { ++i; }
    }

    return (_getController(didAddress), ret);
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function nonce(address didAddress) external view virtual override returns(uint) {
    return _nonce[didAddress];
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function activeDIDCount() external view virtual override returns(uint) {
    return _registeredDIDs.length();
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function getDIDs(uint startIndex, uint count) external view virtual override onlyOwner returns(address[] memory) {
    if (count == 0 || (startIndex + count ) > _registeredDIDs.length()) {
      revert OutOfRange();
    }

    address[] memory ret = new address[](count);

    for (uint i; i < count;) {
      ret[i] = _registeredDIDs.at(startIndex + i);
      unchecked { ++i; }
    }

    return ret;
  }
}
