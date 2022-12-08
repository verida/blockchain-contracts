//SPDX-License-Identifier : MIT
pragma solidity ^0.8.9;

interface IVeridaDIDLinkage {
    /**
     * @notice Link a `did` to an `identifier`
     * @dev Transaction check verification by VDA-Verification-Base contract
     * @param did DID address to be linked
     * @param identifier Identifier that will be linked to did
     * @param signature Used to verify request
     * @param signatureProof Used to verify request
     */
    function link(
        address did, 
        string calldata identifier, 
        bytes calldata signature,
        bytes calldata signatureProof) external;

    /**
     * @notice Unlink an `identifier` from a `did`
     * @param did DID address from which `identifier` is unlinked
     * @param identifier Identifier that is unlinked
     */
    function unlink(address did, string calldata identifier) external;

    /**
     * @notice Check whether an `identifier` is linked to a `did`
     * @param did DID address
     * @param identifier Identifier to be checked the linked status
     * @return bool True if linked, false otherwise.
     */
    function isLinked(address did, string calldata identifier) external returns(bool);

    /**
     * @notice Add a identifierType
     * @dev Only the owner of contract is allowed
     * @param identifierTypeId Type of identifier to be added
     * @param signerType Signer type of identifier type
     */
    function addIdentifierType(string calldata identifierTypeId, string calldata signerType) external;

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
     * @param did DID address
     * @param identifier Identifier to be checked the linked status
     */
    event Link(address did, string identifier);

    /**
     * @notice emitted when an `identifier` is unlinked from a `did`
     * @param did DID address
     * @param identifier Identifier to be checked the linked status
     */
    event Unlink(address did, string identifier);

}