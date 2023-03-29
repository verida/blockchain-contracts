// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import "@verida/vda-verification-contract/contracts/VDAVerificationContract.sol";
import { EnumerableSet } from "@verida/common-contract/contracts/EnumerableSet.sol";

import "./IVeridaDIDLinkage.sol";

error RegisteredIdentifierType();
error InvalidIdentifierType();
error RegisteredIdentifier();
error InvalidIdentifier();
error InvalidAddress();

contract VeridaDIDLinkage is VDAVerificationContract,
    IVeridaDIDLinkage
{

    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using EnumerableSet for EnumerableSet.StringSet;

    /**
     * @notice Signer type for each identifier type
     * @dev mapping of identifier type => signer type
     */
    mapping(string => SignerType) private _identifierType;

    /**
     * @notice Mapping of identifier & it's controller did
     * @dev mapping of identifier => did. did is not an address. Ex of did : "did:vda:0x..."
     */
    mapping(string => string) private _identifierController;

    /**
     * @notice Mapping of did & identifiers list that linked to did
     * @dev mapping of did => identifier set
     */
    mapping(string => EnumerableSet.StringSet) private _didIdentifiers;

    /**
     * @notice Enum representing Signer types
     */
    enum SignerType {
        Unregistered,
        Self,
        Trusted
    }

    /**
     * @notice Initialize
     */
    function initialize() public initializer {
        __VDAVerificationContract_init();
    }

    /**
     * @dev See {IVeridaDIDLinkage}
     */
    function addIdentifierType(string calldata identifierTypeId, bool isSelfSigner) external payable onlyOwner {
        if (_identifierType[identifierTypeId] != SignerType.Unregistered)
            revert RegisteredIdentifierType();
        
        _identifierType[identifierTypeId] = isSelfSigner ? SignerType.Self : SignerType.Trusted;
    }

    /**
     * @dev See {IVeridaDIDLinkage}
     */
    function isTrustedSignerAddress(address signer) external view returns(bool) {
        return _trustedSigners.contains(signer);
    }

    /**
     * @dev See {IVeridaDIDLinkage}
     */
    function link(
        address didAddr, 
        LinkInfo calldata info, 
        bytes calldata requestSignature,
        bytes calldata requestProof) external override
    {
        string memory kind;
        string memory id;
        (kind, id) = parseIdentifier(info.identifier);
        if (_identifierType[kind] == SignerType.Unregistered) {
            revert InvalidIdentifierType();
        }

        string memory strDID = StringsUpgradeable.toHexString(uint256(uint160(didAddr)));
        strDID = string(abi.encodePacked("did:vda:", strDID));

        if (bytes(_identifierController[info.identifier]).length != 0) {
            revert RegisteredIdentifier();
        }

        // Verify data
        {
            bytes memory params = abi.encodePacked(
                didAddr,
                info.identifier,
                info.signedData,
                info.signedProof
            );

            // Verify this request was signed by the DID creating the link
            verifyRequest(didAddr, params, requestSignature, requestProof);

            params = abi.encodePacked(
                strDID,
                "|",
                info.identifier
            );

            if (_identifierType[kind] == SignerType.Self) {
                // SignatureProof should be signed by the id of identifier
                address[] memory signers = new address[](1);
                signers[0] = parseAddr(id);

                // Verify `signedProof` is a valid signed proof by the DID for this link
                verifyDataWithSigners(params, info.signedData, info.signedProof, signers);

            } else {
                // Verify `signedProof` is a valid signed proof by the trusted signer
                verifyData(params, info.signedData, info.signedProof);
            }
        }

        // Link did & identifier
        _identifierController[info.identifier] = strDID;
        _didIdentifiers[strDID].add(info.identifier);

        emit Link(strDID, info.identifier);
    }

    /**
     * @dev See {IVeridaDIDLinkage}
     */
    function unlink(
        address didAddr, 
        string calldata identifier,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external override {
        string memory strDID = StringsUpgradeable.toHexString(uint256(uint160(didAddr)));
        strDID = string(abi.encodePacked("did:vda:", strDID));

        if (!(_didIdentifiers[strDID].contains(identifier))) {
            revert InvalidIdentifier();
        }

        // Verify request
        {
            bytes memory params = abi.encodePacked(
                strDID,
                "|",
                identifier
            );

            verifyRequest(didAddr, params, requestSignature, requestProof);
        }

        delete _identifierController[identifier];
        _didIdentifiers[strDID].remove(identifier);

        emit Unlink(strDID, identifier);
    }

    /**
     * @dev See {IVeridaDIDLinkage}
     */
    function isLinked(string calldata did, string calldata identifier) external view override returns(bool) {
        return _didIdentifiers[did].contains(identifier);
    }

    /**
     * @dev See {IVeridaDIDLinkage}
     */
    function lookup(string calldata identifier) external view override returns(string memory) {
        return _identifierController[identifier];
    }

    /**
     * @dev See {IVeridaDIDLinkage}
     */
    function getLinks(string calldata did) external view override returns(string[] memory) {
        EnumerableSet.StringSet storage list = _didIdentifiers[did];

        uint length = list.length();
        string[] memory ret = new string[](length);

        for (uint i; i < length;) {
            ret[i] = list.at(i);
            unchecked { ++i; }
        }

        return ret;
    }

    /**
     * @notice Convert string to address
     * @param _a string of an address. Ex : '0x15A...'
     */
    function parseAddr(string memory _a) internal pure returns (address _parsedAddress) {
        bytes memory tmp = bytes(_a);
        if (tmp.length != 42) {
            revert InvalidAddress();
        }

        uint160 iaddr;
        uint160 b1;
        uint160 b2;
        for (uint i = 2; i < 2 + 2 * 20;) {
            iaddr *= 256;
            b1 = uint160(uint8(tmp[i]));
            b2 = uint160(uint8(tmp[i + 1]));
            if ((b1 >= 97) && (b1 <= 102)) {
                b1 -= 87;
            } else if ((b1 >= 65) && (b1 <= 70)) {
                b1 -= 55;
            } else if ((b1 >= 48) && (b1 <= 57)) {
                b1 -= 48;
            }
            if ((b2 >= 97) && (b2 <= 102)) {
                b2 -= 87;
            } else if ((b2 >= 65) && (b2 <= 70)) {
                b2 -= 55;
            } else if ((b2 >= 48) && (b2 <= 57)) {
                b2 -= 48;
            }
            iaddr += (b1 * 16 + b2);
            unchecked { i += 2; }
        }
        return address(iaddr);
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
        if (strBytes.length == 0) {
            revert InvalidIdentifier();
        }

        uint len = strBytes.length;

        uint sepPos = len;
        uint index;
        uint8 sepCount;
        while (index < len && sepCount < 2) {
            unchecked {
                if (strBytes[index] == 0x7c) {
                    sepPos = index;
                    ++sepCount;
                }
                ++index;
            }
        }

        if (index != len || sepCount != 1 || sepPos == 0 || sepPos >= (len - 1)) {
            revert InvalidIdentifier();
        }

        bytes memory kindBytes = new bytes(sepPos);
        for (index = 0; index < sepPos;) {
            kindBytes[index] = strBytes[index];
            unchecked { ++index; }
        }

        bytes memory idBytes = new bytes(len - sepPos - 1);
        for (index = sepPos + 1; index < len;) {
            idBytes[index - sepPos - 1] = strBytes[index];
            unchecked { ++index; }
        }

        string memory kind = string(kindBytes);
        string memory id = string(idBytes);

        return (kind, id);
    }

}