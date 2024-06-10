/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.18;

import "./VeridaDIDRegistry.sol";

/** @title VeridaDIDRegistry */
contract VeridaDIDRegistryV2 is VeridaDIDRegistry {
  using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

  /**
   * @notice Return the version of the contract
   */
  function getVersion() external pure virtual returns(string memory) {
    return "2.0";
  }

  /**
   * @dev See {IVeridaDIDRegistry}
   */
  function getDIDs(uint startIndex, uint count) external view virtual override returns(address[] memory) {
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
