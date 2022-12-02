//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

// import "hardhat/console.sol";

contract VDAVerificationContract is OwnableUpgradeable {

    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    /** @notice Nonce for dids */
    mapping(address => uint) internal _nonce;

    /** @notice Trusted signer addresses */
    EnumerableSetUpgradeable.AddressSet internal _trustedSigners;
    
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
     * @notice Add a trusted signer
     * @dev Only the contract owner can add
     * @param did Trusted signer address
     */
    function addTrustedSigner(address did) external onlyOwner {
        if (!_trustedSigners.contains(did)) {
            _trustedSigners.add(did);
        }
    }

    /**
     * @notice Remove a trusted signer
     * @dev Only the contract owner can remove
     * @param did Trusted signer address
     */
    function removeTrustedSigner(address did) external onlyOwner {
        require(_trustedSigners.contains(did), "Unregistered address");
        _trustedSigners.remove(did);
    }


    /**
     * @notice Get a nonce for DID
     * @dev This is used to sign the message. It's for against replay-attack of the transactions
     * @param did DID for nonce
     * @return uint Current nonce of the DID
     */
    function nonce(address did) external view returns(uint) {
        return _nonce[did];
    }
    
     /**
     * @notice Verify whether the request is valid. 
     * @dev Verify the signature & proof signed by valid signers
     * @param did DID for nonce
     * @param params Parameter shows the message
     * @param signature Signature of the message
     * @param proof Proof
     * @param validSigners Available signers list one of which sign the proof
     */
    function verifyRequest(
        address did, 
        bytes memory params, 
        bytes calldata signature, 
        bytes calldata proof,
        EnumerableSetUpgradeable.AddressSet storage validSigners
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
        _nonce[did]++;
    }

    /**
     * @notice Verify whether the request is valid. 
     * @dev Verify the signature & proof signed by valid signers
     * @param did DID for nonce
     * @param params Parameter shows the message
     * @param signature Signature of the message
     * @param proof Proof
     */
    function verifyRequest(
        address did, 
        bytes memory params, 
        bytes calldata signature, 
        bytes calldata proof
    ) internal virtual {
        verifyRequest(did, params, signature, proof, _trustedSigners);
    }
}