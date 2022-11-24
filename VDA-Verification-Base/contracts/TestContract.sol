//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./VDAVerificationContract.sol";

contract TestContract is VDAVerificationContract {

    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    EnumerableSetUpgradeable.AddressSet validSigners;

    function initialize() public initializer {
        __VDAVerificationContract_init();
        
    }

    function testSign(address did, string calldata name, string calldata value, bytes calldata signature , bytes calldata proof) external {
        uint didNonce = getNonce(did);
        bytes memory paramData = abi.encodePacked(
            name,
            value,
            didNonce
        );

        if (!validSigners.contains(did)) {
            validSigners.add(did);
        }
        verifyRequest(did, validSigners, paramData, signature, proof);
    }

    function testRawStringData(address did, bytes calldata rawData, bytes calldata signature, bytes calldata proof) external {
        uint didNonce = getNonce(did);
        bytes memory _unsignedData = abi.encodePacked(
            rawData,
            didNonce
        );

        if (!validSigners.contains(did)) {
            validSigners.add(did);
        }
        verifyRequest(did, validSigners, _unsignedData, signature, proof);
    }
}