/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.18;

import "./VeridaDIDRegistry.sol";

/** @title VeridaDIDRegistry */
contract VeridaDIDRegistryV2 is VeridaDIDRegistry {
  function getVersion() external pure virtual returns(string memory) {
    return "2.0";
  }
}
