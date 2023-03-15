//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./NameRegistry.sol";

/**
 * @title Verida NameRegistry contract
 */
contract NameRegistryV2 is  NameRegistry {

    function getVersion() external pure returns(string memory) {
        return "2.0.0";
    }
}