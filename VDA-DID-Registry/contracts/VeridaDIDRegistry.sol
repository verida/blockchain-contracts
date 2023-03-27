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
  EnumerableSetUpgradeable.AddressSet private _registeredDIDs;

  /**
   * @notice Map of registered DID info
   * @dev DID address => DIDInfo
   */
  mapping(address => DIDInfo) private _DIDInfo;

  /**
   * @notice Next nonce of DID
   * @dev DID address => nonce
   */
  mapping(address => uint) private _nonce;

  /**
   * @notice Struct representing the DID info
   */
  struct DIDInfo {
    address controller;
    EnumerableSet.StringSet endpoints;
  }
  
  /**
   * @notice Initialize
   */
  function initialize() public initializer {
    __Ownable_init();
  }

  /**
   * @notice Check whether the DID is registered
   * @dev Revoked DIDs are not registered ones
   */
  function isRegistered(address didAddress) internal view returns(bool) {
    return _registeredDIDs.contains(didAddress);
  }
  
  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function register(address didAddress, string[] calldata endpoints, bytes calldata signature ) external override {
    if (_nonce[didAddress] != 0) {
      require(isRegistered(didAddress), "Revoked DID address");
    }

    {
      bytes memory rawMsg = abi.encodePacked(didAddress, "/");
      for (uint i; i < endpoints.length;) {
        rawMsg = abi.encodePacked(rawMsg, endpoints[i], "/");
        unchecked { ++i; }
      }

      rawMsg = abi.encodePacked(rawMsg, _nonce[didAddress]);

      require(VeridaDataVerificationLib.validateSignature(rawMsg, signature, didAddress), "Invalid signature");
      _nonce[didAddress]++;
    }

    EnumerableSet.StringSet storage list = _DIDInfo[didAddress].endpoints;
    list.clear();
    
    for (uint i; i < endpoints.length;) {
      list.add(endpoints[i]);
      unchecked { ++i; }
    }

    // Add didAddress for only new registers
    if (!isRegistered(didAddress)) {
      _registeredDIDs.add(didAddress);
    }

    emit Register(didAddress, endpoints);
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function revoke(address didAddress, bytes calldata signature) external override {
    require(isRegistered(didAddress), "Unregistered address");
    {
      address controller = _getController(didAddress);
      bytes memory rawMsg = abi.encodePacked(
        didAddress, 
        "/revoke/",
        _nonce[didAddress]);
      
      require(VeridaDataVerificationLib.validateSignature(rawMsg, signature, controller), "Invalid signature");
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
   * @return address Controller of DID address
   */
  function _getController(address didAddress) internal view returns(address) {
    if (_DIDInfo[didAddress].controller == address(0x0))
      return didAddress;
    return _DIDInfo[didAddress].controller;
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function getController(address didAddress) external view override returns(address) {
    return _getController(didAddress);
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function setController(address didAddress, address controller, bytes calldata signature) external override {
    require(isRegistered(didAddress), "Unregistered address");
    {
      address oldController = _getController(didAddress);
      bytes memory rawMsg = abi.encodePacked(
        didAddress, 
        "/setController/",
        controller,
        "/",
        _nonce[didAddress]);
      
      require(VeridaDataVerificationLib.validateSignature(rawMsg, signature, oldController), "Invalid signature");
      _nonce[didAddress]++;
    }

    _DIDInfo[didAddress].controller = controller;

    emit SetController(didAddress, controller);
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function lookup(address didAddress) external view override returns(address, string[] memory) {
    require(isRegistered(didAddress), "Unregistered address");

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
  function nonce(address didAddress) external view override returns(uint) {
    return _nonce[didAddress];
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function activeDIDCount() external view override returns(uint) {
    return _registeredDIDs.length();
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function getDIDs(uint startIndex, uint count) external view onlyOwner override returns(address[] memory) {
    require(count != 0 && (startIndex + count) <= _registeredDIDs.length(), "Out of range");

    address[] memory ret = new address[](count);

    for (uint i; i < count;) {
      ret[i] = _registeredDIDs.at(startIndex + i);
      unchecked { ++i; }
    }

    return ret;
  }
}
