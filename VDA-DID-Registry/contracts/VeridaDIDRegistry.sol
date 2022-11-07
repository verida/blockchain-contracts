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
   * @notice Map of nonce
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

    {
      bytes memory rawMsg = abi.encodePacked(didAddress);
      for (uint i = 0; i < endpoints.length; i++) {
        rawMsg = abi.encodePacked(rawMsg, endpoints[i]);
      }

      rawMsg = abi.encodePacked(rawMsg, _nonce[didAddress]);

      require(VeridaDataVerificationLib.validateSignature(rawMsg, signature, didAddress), "Invalid Signature");
      _nonce[didAddress]++;
    }

    EnumerableSet.StringSet storage list = _endpoints[didAddress];
    list.clear();
    
    for (uint i = 0; i < endpoints.length; i++ ) {
      list.add(endpoints[i]);
    }

    emit Register(didAddress, endpoints);
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function lookup(address didAddress) external view override returns(string[] memory) {
    EnumerableSet.StringSet storage list = _endpoints[didAddress];

    uint length = list.length();
    string[] memory ret = new string[](length);

    for (uint i = 0; i < length; i++) {
      ret[i] = list.at(i);
    }

    return ret;
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function nonce(address didAddress) external view override returns(uint) {
    return _nonce[didAddress];
  }
}
