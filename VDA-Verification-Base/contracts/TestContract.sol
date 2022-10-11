//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./VDAVerificationContract.sol";

contract TestContract is VDAVerificationContract {

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

        verifyRequest(did, paramData, signature, proof);
    }

    function testRawStringData(address did, bytes calldata rawData, bytes calldata signature, bytes calldata proof) external {
        uint didNonce = getNonce(did);
        bytes memory _unsignedData = abi.encodePacked(
            rawData,
            didNonce
        );

        verifyRequest(did, _unsignedData, signature, proof);
    }
}