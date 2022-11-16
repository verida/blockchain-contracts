/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.6;

// import "hardhat/console.sol";
import { VeridaDataVerificationLib } from "./VeridaDataVerificationLib.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./IVeridaDIDRegistry.sol";
import "./EnumerableSet.sol";

/** @title VeridaDIDRegistry */
contract VeridaDIDRegistry is OwnableUpgradeable, IVeridaDIDRegistry {

  using EnumerableSet for EnumerableSet.StringSet;

  /**
   * @notice Map of controllers
   * @dev DID address => controller address
   */
  mapping (address => address) private _controllers;

  /**
   * @notice Flags for registered status
   * @dev DID address => bool
   */
  mapping (address => bool) private _isRegistered;

  /**
   * @notice Next nonce of DID
   * @dev DID address => nonce
   */
  mapping(address => uint) private _nonce;

  /**
   * @notice Map of endpoints
   * @dev DID address => List of endpoints
   */
  mapping (address => EnumerableSet.StringSet) private _endpoints;

  /**
   * @notice Initialize
   */
  function initialize() public initializer {
    __Ownable_init();
  }
  
  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function register(address didAddress, string[] calldata endpoints, bytes calldata signature ) external override {
    if (_nonce[didAddress] != 0) {
      require(_isRegistered[didAddress], "Revoked DID address");
    }

    {
      bytes memory rawMsg = abi.encodePacked(didAddress, "/");
      for (uint i = 0; i < endpoints.length; i++) {
        rawMsg = abi.encodePacked(rawMsg, endpoints[i], "/");
      }

      rawMsg = abi.encodePacked(rawMsg, _nonce[didAddress]);

      require(VeridaDataVerificationLib.validateSignature(rawMsg, signature, didAddress), "Invalid signature");
      _nonce[didAddress]++;
    }

    EnumerableSet.StringSet storage list = _endpoints[didAddress];
    list.clear();
    
    for (uint i = 0; i < endpoints.length; i++ ) {
      list.add(endpoints[i]);
    }

    _isRegistered[didAddress] = true;

    emit Register(didAddress, endpoints);
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function revoke(address didAddress, bytes calldata signature) external override {
    require(_isRegistered[didAddress], "Unregistered address");
    {
      address controller = _getController(didAddress);
      bytes memory rawMsg = abi.encodePacked(
        didAddress, 
        "/revoke/",
        _nonce[didAddress]);
      
      require(VeridaDataVerificationLib.validateSignature(rawMsg, signature, controller), "Invalid signature");
      _nonce[didAddress]++;
    }

    delete _controllers[didAddress];

    EnumerableSet.StringSet storage list = _endpoints[didAddress];
    list.clear();

    _isRegistered[didAddress] = false;

    emit Revoke(didAddress);
  }

  /**
   * @notice Internal function to get a controller of DID address
   * @dev This is internal function to be used in another functions. Gas efficient than external function
   * @param didAddress DID address
   * @return address Controller of DID address
   */
  function _getController(address didAddress) internal view returns(address) {
    if (_controllers[didAddress] == address(0x0))
      return didAddress;
    return _controllers[didAddress];
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
    require(_isRegistered[didAddress], "Unregistered address");
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

    _controllers[didAddress] = controller;

    emit SetController(didAddress, controller);
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function lookup(address didAddress) external view override returns(address, string[] memory) {
    require(_isRegistered[didAddress], "Unregistered address");

    EnumerableSet.StringSet storage list = _endpoints[didAddress];
    uint length = list.length();

    string[] memory ret = new string[](length);

    for (uint i = 0; i < length; i++) {
      ret[i] = list.at(i);
    }

    return (_getController(didAddress), ret);
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function nonce(address didAddress) external view override returns(uint) {
    return _nonce[didAddress];
  }
}
