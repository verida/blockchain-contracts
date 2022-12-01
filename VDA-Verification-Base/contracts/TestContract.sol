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

    function recoverTest(bytes calldata params, bytes calldata signature) external pure returns(address){
        bytes32 paramHash = keccak256(params);
        address signer = ECDSAUpgradeable.recover(paramHash, signature);

        return signer;
    }

    function rawRecover(string calldata params, bytes calldata signature) external pure returns(address) {
        bytes32 paramHash = keccak256(bytes(params));
        address signer = ECDSAUpgradeable.recover(paramHash, signature);

        return signer;
    }

    function rawRecoverAddress(address addr1, address addr2, bytes calldata signature) external view returns(address) {
        string memory strAddr1 = StringsUpgradeable.toHexString(uint256(uint160(addr1)));
        string memory strAddr2 = StringsUpgradeable.toHexString(uint256(uint160(addr2)));

        bytes memory merged = abi.encodePacked(strAddr1, strAddr2);

        bytes32 paramHash = keccak256(merged);
        address signer = ECDSAUpgradeable.recover(paramHash, signature);

        return signer;
    }
}