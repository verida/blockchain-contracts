//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./VDAVerificationContract.sol";

contract TestContract is VDAVerificationContract {

    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    EnumerableSetUpgradeable.AddressSet private validSigners;

    struct VerifyStringParams {
        string rawString;
        string signedData;
        string signerProof;
        uint nonce;
    }

    function initialize() public initializer {
        __VDAVerificationContract_init();
        
    }

    /**
     * @notice Verify signature & proof. Message is generated from muliple arguments (name & value)
     * @dev This function will get success if the signature & proof are correct
     * @param did DID for nonce
     * @param name Test parameter for signature
     * @param value Test parameter for signature
     * @param signature Signature of message
     * @param proof Proof
     */
    function testSign(address did, string calldata name, string calldata value, bytes calldata signature , bytes calldata proof) external {
        uint didNonce = _nonce[did];
        bytes memory paramData = abi.encodePacked(
            name,
            value,
            didNonce
        );

        verifyRequest(did, paramData, signature, proof);
    }

    /**
     * @notice Verify signature & proof. Message is only one parameter - rawData.
     * @dev Almost same as testSign(...) function except function parameters.
     * @param did DID for nonce
     * @param rawData Message
     * @param signature Signature of Message
     * @param proof Proof
     */
    function testRawStringData(address did, bytes calldata rawData, bytes calldata signature, bytes calldata proof) external {
        uint didNonce = _nonce[did];
        bytes memory _unsignedData = abi.encodePacked(
            rawData,
            didNonce
        );

        verifyRequest(did, _unsignedData, signature, proof);
    }

    /**
     * @notice Test function for `test/proof.ts`
     * @dev This function works the same as verifyRequest(...) of VDAVerificationContract.sol
     * @param did DID for nonce
     * @param params Parameter shows the message
     * @param signature Signature of the message
     * @param proof Proof
     */
    function verifyStringRequest(
        address did, 
        bytes calldata params, 
        bytes calldata signature, 
        bytes calldata proof
    ) external returns(string memory) {
        // Verify the `params` were signed by the requesting `did` and has the correct nonce to prevent replay attacks
        verifyRequest(did, params, signature, proof);

        // Unpack the params
        bytes memory _unsignedData = abi.encodePacked();

        // Verify `signedData` (from params) matches `rawString` (from params) is signed by a DID in `validSigners`
        VerifyStringParams memory _params;
        (_params) = abi.decode(_unsignedData, (VerifyStringParams));
        verifyData(bytes(_params.rawString), bytes(_params.signedData), bytes(_params.signerProof));

        // We can now use _params.rawString and trust it was signed by a valid signer
        return _params.rawString;
    }

    /**
     * @notice Get the signer from a inputed message - bytes type
     * @param params Message of bytes type
     * @param signature Signature of params
     * @return address Signer of the message
     */
    function recoverTest(bytes calldata params, bytes calldata signature) external pure returns(address){
        bytes32 paramHash = keccak256(params);
        address signer = ECDSAUpgradeable.recover(paramHash, signature);

        return signer;
    }

    /**
     * @notice Get the signer from a inputed message - string
     * @param params Message of string
     * @param signature Signature of params
     * @return address Signer of the message
     */
    function rawRecover(string calldata params, bytes calldata signature) external pure returns(address) {
        bytes32 paramHash = keccak256(bytes(params));
        address signer = ECDSAUpgradeable.recover(paramHash, signature);

        return signer;
    }

    /**
     * @notice Get the signer. Message is literal string of 2 addresses - `${addr1}${addr2}`
     * @dev The signature was signed into raw string message. Here, we generate same string message from 2 addresses
     * @param addr1 Address for message
     * @param addr2 Address for message
     * @param signature Signature of the message
     * @return address Signer of the message
     */
    function rawRecoverAddress(address addr1, address addr2, bytes calldata signature) external view returns(address) {
        string memory strAddr1 = StringsUpgradeable.toHexString(uint256(uint160(addr1)));
        string memory strAddr2 = StringsUpgradeable.toHexString(uint256(uint160(addr2)));

        bytes memory merged = abi.encodePacked(strAddr1, strAddr2);

        bytes32 paramHash = keccak256(merged);
        address signer = ECDSAUpgradeable.recover(paramHash, signature);

        return signer;
    }
}