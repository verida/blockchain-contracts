//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

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
     * @param didAddress Trusted signer address
     */
    function addTrustedSigner(address didAddress) external onlyOwner {
        require(!_trustedSigners.contains(didAddress), "Already registered");
        _trustedSigners.add(didAddress);
    }

    /**
     * @notice Remove a trusted signer
     * @dev Only the contract owner can remove
     * @param didAddress Trusted signer address
     */
    function removeTrustedSigner(address didAddress) external onlyOwner {
        require(_trustedSigners.contains(didAddress), "Unregistered address");
        _trustedSigners.remove(didAddress);
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
     * Verify any data is signed by a trusted signering DID address
     *
     * @param data Any type of raw data
     * @param signature Data signed by a Verida application context signing key
     * @param proof Signed proof that a Verida DID controls a Verida application context signing key
     */
    function verifyData(
        bytes memory data, 
        bytes memory signature,
        bytes memory proof
    ) internal virtual {
        require(_trustedSigners.length() > 0, "No signers provided");

        bytes32 dataHash = keccak256(data);
        address contextSigner = ECDSAUpgradeable.recover(dataHash, signature);
        string memory strContextSigner = StringsUpgradeable.toHexString(uint256(uint160(contextSigner)));

        bool isVerified = false;
        uint index = 0;

        while (index < _trustedSigners.length() && !isVerified) {
            address account = _trustedSigners.at(index);

            string memory strAccount = StringsUpgradeable.toHexString(uint256(uint160(account)));
            bytes memory proofString = abi.encodePacked(
                strAccount,
                strContextSigner
            );
            bytes32 proofHash = keccak256(proofString);
            address didSigner = ECDSAUpgradeable.recover(proofHash, proof);

            if (didSigner == account) {
                isVerified = true;
                break;
            }
            index++;
        }

        require(isVerified, "Data is not signed by a valid signing DID");
    }
    
    /**
     * Verify any data is signed by a particular array of DID addresses
     *
     * @param data Any type of raw data
     * @param signature Data signed by a Verida application context signing key
     * @param proof Signed proof that a Verida DID controls a Verida application context signing key
     * @param validSigners Array of did addresses that are valid signers of data
     */
    function verifyDataWithSigners(
        bytes memory data, 
        bytes memory signature,
        bytes memory proof,
        address[] memory validSigners
    ) internal virtual {
        require(validSigners.length > 0, "No signers provided");

        bytes32 dataHash = keccak256(data);
        address contextSigner = ECDSAUpgradeable.recover(dataHash, signature);
        string memory strContextSigner = StringsUpgradeable.toHexString(uint256(uint160(contextSigner)));

        bool isVerified = false;
        uint index = 0;

        while (index < validSigners.length && !isVerified) {
            address account = validSigners[index];

            string memory strAccount = StringsUpgradeable.toHexString(uint256(uint160(account)));
            bytes memory proofString = abi.encodePacked(
                strAccount,
                strContextSigner
            );
            bytes32 proofHash = keccak256(proofString);
            address didSigner = ECDSAUpgradeable.recover(proofHash, proof);

            if (didSigner == account) {
                isVerified = true;
                break;
            }
            index++;
        }

        require(isVerified, "Data is not signed by a valid signing DID");
    }
    
     /**
     * @notice Verify whether a given request is valid. Verifies the nonce of the DID making the request.
     * 
     * @dev Verify the signature & proof signed by valid signers
     * 
     * @param did DID that made the request. Nonce will be incremented against this DID to avoid replay attacks.
     * @param params Parameters of the message.
     * @param signature A signature that matches sign(${didSignAddress}, params)
     * @param proof Proof A signature that matches sign(did, `${didAddress}${didSignAddress}`)
     */
    function verifyRequest(
        address did, 
        bytes memory params, 
        bytes memory signature, 
        bytes memory proof
    ) internal virtual {
        // Verify the nonce is valid by including it in the unsignedData to be checked
        uint didNonce = _nonce[did];
        bytes memory unsignedParams = abi.encodePacked(
            params,
            didNonce
        );

        address[] memory signers = new address[](1);
        signers[0] = did;

        // Verify the params were signed by the DID making the request
        verifyDataWithSigners(
            unsignedParams,
            signature,
            proof,
            signers
        );

        // Increment the nonce to prevent replay attacks
        _nonce[did]++;
    }
}