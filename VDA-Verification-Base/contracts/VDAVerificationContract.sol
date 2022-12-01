//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

// import "hardhat/console.sol";

contract VDAVerificationContract is OwnableUpgradeable {

    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    mapping(address => uint) internal nonce;
    
    /**
     * @notice Initializer for deploying the contract
     * @dev This contract can't be deployed directly. Should be used as a parent class only
     */
    function __VDAVerificationContract_init() internal onlyInitializing {
        __Ownable_init();
        __VDAVerificationContract_init_unchained();
    }

    /**
     * @notice Initializer for deploying the contract
     * @dev Initialze the necessary stuffs those are unique to this contract
     */
    function __VDAVerificationContract_init_unchained() internal onlyInitializing {
    }

    /**
     * @notice Get a nonce for DID
     * @dev This is used to sign the message. It's for against replay-attack of the transactions
     * @param did DID for nonce
     * @return uint Current nonce of the DID
     */
    function getNonce(address did) public view returns(uint) {
        return nonce[did];
    }

     /**
     * @notice Verify whether the request is valid. 
     * @dev Verify the signature & proof signed by valid signers
     * @param did DID for nonce
     * @param validSigners Available signers list one of which sign the proof
     * @param params Parameter shows the message
     * @param signature Signature of the message
     * @param proof Proof
     */
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
        string memory strContextSigner = StringsUpgradeable.toHexString(uint256(uint160(contextSigner)));

        bool isVerified = false;
        uint index = 0;

        while (index < validSigners.length() && !isVerified) {
            address account = validSigners.at(index);
            string memory strAccount = StringsUpgradeable.toHexString(uint256(uint160(account)));
            bytes memory proofString = abi.encodePacked(
                strAccount,
                strContextSigner
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