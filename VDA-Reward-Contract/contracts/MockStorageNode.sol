//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { IStorageNode } from "./IStorageNode.sol";
/**
 * This is Mock contract. No need to audit.
 * Only used in test script.
 */
contract MockStorageNode is IStorageNode {

    /** ReardToken : ERC20 contract */
    IERC20Upgradeable internal veridaToken;

    /** Deposited amount of addresses */
    mapping(address => uint) internal _stakedTokenAmount;

    constructor(IERC20Upgradeable token) {
        veridaToken = token;
    }

    function depositTokenFromProvider(address didAddress, address from, uint tokenAmount) external {
        veridaToken.transferFrom(from, address(this), tokenAmount);

        _stakedTokenAmount[didAddress] += tokenAmount;

        emit TokenDeposited(didAddress, from, tokenAmount);
    }

    function getBalance(address didAddress) external view returns(uint) {
      return _stakedTokenAmount[didAddress];
  }



} 