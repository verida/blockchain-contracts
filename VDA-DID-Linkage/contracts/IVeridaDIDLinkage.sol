// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IVeridaDIDLinkage {

    /**
     * @notice Link information
     * @param identifier Identifier that will be linked to did
     * @param signedData Signer signature of identifier
     * @param signatureProof Signer proof
     */
    struct LinkInfo {
        string identifier;
        bytes signedData;
        bytes signedProof;
    }

    /**
     * @notice Link a `did` to an `identifier`
     * @dev Transaction check verification by VDA-Verification-Base contract
     * @param didAddr DID address to be linked
     * @param info Link information
     * @param requestSignature Used to verify request
     * @param requestProof Used to verify request
     */
    function link(
        address didAddr, 
        LinkInfo calldata info, 
        bytes calldata requestSignature,
        bytes calldata requestProof) external;

    /**
     * @notice Unlink an `identifier` from a `did`
     * @param didAddr DID address from which `identifier` is unlinked
     * @param identifier Identifier that is unlinked
     * @param requestSignature Used to verify request
     * @param requestProof Used to verify request
     */
    function unlink(
        address didAddr, 
        string calldata identifier,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external;

    /**
     * @notice Check whether an `identifier` is linked to a `did`
     * @param did DID
     * @param identifier Identifier to be checked the linked status
     * @return bool True if linked, false otherwise.
     */
    function isLinked(string calldata did, string calldata identifier) external view returns(bool);

    /**
     * @notice Get controller did of an identifier
     * @param identifier Identifier
     * @return string Controller DID
     */
    function lookup(string calldata identifier) external view returns(string memory);

    /**
     * @notice Get the identifier list that is being controlled by inputed DID
     * @param did DID
     */
    function getLinks(string calldata did) external view returns(string[] memory);

    /**
     * @notice Add a identifierType
     * @dev Only the owner of contract is allowed
     * @param identifierTypeId Type of identifier to be added
     * @param isSelfSigner If true, signer type is self signed, otherwise trusted signer
     */
    function addIdentifierType(string calldata identifierTypeId, bool isSelfSigner) external payable;

    /**
     * @notice Check whether an address is trusted
     * @dev Only owner of contract can check
     * @param signer Signer address to be checked
     */
    function isTrustedSignerAddress(address signer) external view returns(bool);

    /**
     * @notice Struct for Identifier type
     * @dev An `identifier` is inputed as a string and parsed to a struct
     */
    struct Identifier {
        string kind;
        string id;
    }

    /**
     * @notice emitted when an `identifer` is linked to a `did`
     * @param did DID
     * @param identifier Identifier linked
     */
    event Link(string did, string identifier);

    /**
     * @notice emitted when an `identifier` is unlinked from a `did`
     * @param did DID
     * @param identifier Identifier unlinked
     */
    event Unlink(string did, string identifier);

    /**
     * @notice emitted when an identifierType added
     * @param identifierTypeId Type of identifier to be added
     * @param isSelfSigner If true, signer type is self signed, otherwise trusted signer
     */
    event AddIdentifierType(string identifierTypeId, bool isSelfSigner);

}