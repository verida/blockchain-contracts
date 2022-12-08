//SPDX-License-Identifier : MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import "@verida/vda-verification-contract/contracts/VDAVerificationContract.sol";

import "./IVeridaDIDLinkage.sol";

contract VeridaDIDLinkage is VDAVerificationContract,
    IVeridaDIDLinkage, 
    OwnableUpgradeable 
{

    // using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    /**
     * @notice Signer type for each identifier type
     * @dev mapping of identifier type => signer type
     */
    mapping(string => string) private _identifierType;

    /**
     * @notice Initialize
     */
    function initialize() public initializer {
        __VDAVerificationContract_init();
    }

    /**
     * @dev See {IVeridaDIDLinkage}
     */
    function addIdentifierType(string calldata identifierTypeId, string calldata signerType) external onlyOwner {
        require(bytes(_identifierType[identifierTypeId]).length == 0, "Registered type");
        require(signerType == "Self" || signerType == "Trusted", "Invalid signer type");

        _identifierType[identifierTypeId] = signerType;
    }

    /**
     * @dev See {IVeridaDIDLinkage}
     */
    function isTrustedSignerAddress(address signer) external view returns(bool) {
        return _trustedSigners.contains(signer);
    }

    /**
     * @notice Parse Identifier and returns kind & id
     * @param identifier Identifier. Ex : "blockchain:eip155|0x0D10C68F52326C47Dfc3FDBFDCCb37e3b8C852Cb"
     * @return string Identifier kind. Ex : "blockchain:eip155"
     * @return string Identifier id. Ex: "eip155|0x0D10C68F52326C47Dfc3FDBFDCCb37e3b8C852Cb"
     */
    function parseIdentifier(string calldata identifier) internal pure returns(string memory, string memory) {
        //0x7c
        bytes memory strBytes = bytes(identifier);
        require(strBytes.length > 0, "Invalid identifier");

        uint len = strBytes.length;

        uint sepPos = len;
        uint index = 0;
        uint8 sepCount = 0;
        while (index < len && sepCount < 2) {
            if (strBytes[index] == 0x7c) {
                sepPos = index;
                sepCount++;
            }
            index++;
        }

        require(index == len && sepCount == 1 && sepPos > 0 && sepPos < (len - 1), "Invalid identifier");

        bytes memory kindBytes = new bytes(sepPos);
        for (index = 0; index < sepPos; index++) {
            kindBytes[index] = strBytes[index];
        }

        bytes memory idBytes = new bytes(len - sepPos - 1);
        for (index = sepPos + 1; index < len; index++) {
            idBytes[index - sepPos - 1] = strBytes[index];
        }

        string memory kind = string(kindBytes);
        string memory id = string(idBytes);

        return (kind, id);
    }

    /**
     * @dev See {IVeridaDIDLinkage}
     */
    function link(
        address did, 
        string calldata identifier, 
        bytes calldata signature,
        bytes calldata signatureProof) external 
    {
        string memory kind;
        string memory id;
        (kind, id) = parseIdentifier(identifier);
        require(bytes(_identifierType[kind]).length > 0, "Invalid identifier type");

        string memory strDID = StringsUpgradeable.toHexString(uint256(uint160(did)));
        bytes memory rawMsg = abi.encodePacked(
            "did:vda:",
            strDID,
            "|",
            identifier
        );

        if (_identifierType[kind] == "Self") {
            // SignatureProof should be signed by the id of identifier

        } else {
            // SignatureProof should be signed by the trusted signers
        }

        
        
    }

}