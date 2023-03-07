//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./NameRegistry.sol";

/**
 * @title Verida NameRegistry contract
 */
contract NameRegistryV2 is  NameRegistry {

    function getVersion() external returns(string memory) {
        return "2.0.0";
    }
}