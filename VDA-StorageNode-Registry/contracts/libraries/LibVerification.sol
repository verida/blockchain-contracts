// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

error NoSigners();
error InvalidSignature();
error InvalidFallbackNodeSiganture();

library LibVerification {
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("vda.storagenode.verification.storage");

    
    struct DiamondStorage {
        mapping(address => uint) nonce;
        EnumerableSet.AddressSet trustedSigners;
    }

    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /**
     * @notice Get a nonce for DID
     * @dev This is used to sign the message. It's for against replay-attack of the transactions
     * @param did DID for nonce
     * @return uint Current nonce of the DID
     */
    function nonce(address did) internal view returns(uint) {
        return diamondStorage().nonce[did];
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
    ) internal view {
        DiamondStorage storage ds = diamondStorage();
        if (ds.trustedSigners.length() == 0) {
            revert NoSigners();
        }

        if (data.length == 0 || signature.length == 0 || proof.length == 0) {
            revert InvalidSignature();
        }

        bytes32 dataHash = keccak256(data);
        address contextSigner = ECDSA.recover(dataHash, signature);
        string memory strContextSigner = Strings.toHexString(uint256(uint160(contextSigner)));

        bool isVerified;
        uint index;

        while (index < ds.trustedSigners.length() && !isVerified) {
            address account = ds.trustedSigners.at(index);

            string memory strAccount = Strings.toHexString(uint256(uint160(account)));
            bytes memory proofString = abi.encodePacked(
                strAccount,
                strContextSigner
            );
            bytes32 proofHash = keccak256(proofString);
            address didSigner = ECDSA.recover(proofHash, proof);

            if (didSigner == account) {
                isVerified = true;
                break;
            }
            unchecked { ++index; }
        }

        if (!isVerified) {
            revert InvalidSignature();
        }
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
    ) internal pure {
        if (validSigners.length == 0) {
            revert NoSigners();
        }

        if (data.length == 0 || signature.length == 0 || proof.length == 0) {
            revert InvalidSignature();
        }

        bytes32 dataHash = keccak256(data);
        address contextSigner = ECDSA.recover(dataHash, signature);
        string memory strContextSigner = Strings.toHexString(uint256(uint160(contextSigner)));

        bool isVerified;
        uint index;

        while (index < validSigners.length && !isVerified) {
            address account = validSigners[index];

            string memory strAccount = Strings.toHexString(uint256(uint160(account)));
            bytes memory proofString = abi.encodePacked(
                strAccount,
                strContextSigner
            );
            bytes32 proofHash = keccak256(proofString);
            address didSigner = ECDSA.recover(proofHash, proof);

            if (didSigner == account) {
                isVerified = true;
                break;
            }
            unchecked { ++index; }
        }

        if (!isVerified) {
            revert InvalidSignature();
        }
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
    ) internal {
        // Verify the nonce is valid by including it in the unsignedData to be checked
        DiamondStorage storage ds = diamondStorage();
        uint didNonce = ds.nonce[did];
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
        ++ds.nonce[did];
    }

    /**
     * @notice Check the `authSignature` parameter of `addNode()` function
     * @param didAddress DID address that is associated with the storage node
     * @param authSignature Signature signed by a trusted signer
     */
    function verifyAuthSignature(address didAddress, bytes calldata authSignature) internal view {
        EnumerableSet.AddressSet storage signers = diamondStorage().trustedSigners;

        if (signers.length() == 0) {
            revert NoSigners();
        }

        if (authSignature.length == 0) {
            revert InvalidSignature();
        }

        bytes memory rawMsg = abi.encodePacked(didAddress);
        bytes32 msgHash = keccak256(rawMsg);

        address authSigner = ECDSA.recover(msgHash, authSignature);

        bool isVerified;
        uint index;
        
        while (index < signers.length() && !isVerified) {
            address account = signers.at(index);

            if (authSigner == account) {
                isVerified = true;
                break;
            }

            unchecked { ++index; }
        }

        if (!isVerified) {
            revert InvalidSignature();
        }   
    }

    /**
     * @notice Check the signer of the `signature`
     * @dev Used in the `removeNodeStart()` and `removeNodeComplete()` functions
     * @param msgSigner Signer address
     * @param data Raw message data
     * @param signature Data signed by the fallback node
     */
    function verifyFallbackNodeSignature(
        address msgSigner, 
        bytes memory data, 
        bytes calldata signature
    ) internal pure {
        if (data.length == 0 || signature.length == 0) {
            revert InvalidFallbackNodeSiganture();
        }

        bytes32 dataHash = keccak256(data);
        address recoveredSigner = ECDSA.recover(dataHash, signature);
        if (msgSigner != recoveredSigner) {
            revert InvalidFallbackNodeSiganture();
        }

    }
}
