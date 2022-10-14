//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

contract VDAVerificationContract is OwnableUpgradeable {

    mapping(address => uint) internal nonce;
    
    function __VDAVerificationContract_init() internal onlyInitializing {
        __Ownable_init();
        __VDAVerificationContract_init_unchained();
    }

    function __VDAVerificationContract_init_unchained() internal onlyInitializing {
    }

    function getNonce(address did) public view returns(uint) {
        return nonce[did];
    }

    function verifyRequest(address did, bytes memory params, bytes calldata signature, bytes calldata proof) internal {
        bytes32 paramsHash = keccak256(params);
        address paramSigner = ECDSAUpgradeable.recover(paramsHash, signature);

        bytes memory proofString = abi.encodePacked(
            "did:vda:",
            did,
            "-",
            paramSigner
        );
        bytes32 proofHash = keccak256(proofString);
        address proofSigner = ECDSAUpgradeable.recover(proofHash, proof);
        require(proofSigner == did, "Invalid proof");

        nonce[did]++;
    }
}