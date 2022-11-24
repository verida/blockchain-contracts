//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

contract VDAVerificationContract is OwnableUpgradeable {

    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

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

    function verifyRequest(
        address did, 
        EnumerableSetUpgradeable.AddressSet storage validSigners,
        bytes memory params, 
        bytes calldata signature, 
        bytes calldata proof
    ) internal virtual {
        require(validSigners.length() > 0, "No signers available");

        bytes32 paramsHash = keccak256(params);
        address contextSigner = ECDSAUpgradeable.recover(paramsHash, signature);

        bool isVerified = false;
        uint index = 0;

        while (index < validSigners.length() && !isVerified) {
            address account = validSigners.at(index);
            bytes memory proofString = abi.encodePacked(
                account,
                '-',
                contextSigner
            );
            bytes32 proofHash = keccak256(proofString);
            address didSigner = ECDSAUpgradeable.recover(proofHash, proof);

            if (didSigner == account){
                isVerified = true;
                break;
            }
            index++;
        }

        require(isVerified, "Invalid proof");
        nonce[did]++;
    }
}