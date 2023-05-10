// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "@verida/vda-verification-contract/contracts/VDAVerificationContract.sol";
import "@verida/common-contract/contracts/EnumerableSet.sol";

import "./IERC5192.sol";
import "./ISoulboundNFT.sol";

contract SoulboundNFT is VDAVerificationContract, 
    IERC721MetadataUpgradeable,
    ERC721URIStorageUpgradeable, 
    IERC5192, 
    ISoulboundNFT {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;
    using EnumerableSet for EnumerableSet.StringSet;

    /**
     * @notice tokenId counter
     * @dev tokenId starts from 1.
     */
    CountersUpgradeable.Counter private _tokenIdCounter;

    /**
     * @notice SBT types of Verida
     */
    EnumerableSet.StringSet private _sbtTypes;

    /**
     * @notice Claimed SBT info by users
     * @dev mapping of User => SBTType => UniqueId => tokenId
     */
    mapping(address => mapping(string => mapping(string => uint))) private _userInfo;
    /** 
     * @notice SBT type of tokenId
     * @dev mapping of tokenId => TokenInfo
     */
    mapping(uint => TokenInfo) private _tokenIdInfo;

    /**
     * @notice Claimed tokenId list of users
     * @dev mapping of user's address to tokenId list
     * SBT tokens can't be transferred to other users. It can be transferred to 0x0 for burning
     */
    mapping(address => EnumerableSetUpgradeable.UintSet) _userTokenIds;

    // Custom errors
    error TransferBlocked();
    error NoPermission();
    error InvalidSBTInfo(bool invalidSBTType, bool emptyUniqueId, bool emptyURI);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev initializer of deployment
     */
    function initialize() initializer public {
        __ERC721_init("Verida SBT", "VSBT");
        __VDAVerificationContract_init();
    }

    // The following functions are overrides required by Solidity.
    /**
     * @dev returns the token uri of tokenId
     * @param tokenId tokenId minted
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(IERC721MetadataUpgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return ERC721URIStorageUpgradeable.tokenURI(tokenId);
    }

    /**
     * @dev Overrides of super class function. Restrict to be transferred for locked token
     * See {IERC721Upgradeable}
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
        ) internal override virtual {
        assembly {
            if eq(iszero(from), 0) {
                if eq(iszero(to), 0) {
                    let ptr := mload(0x40)
                    mstore(ptr, 0xf90e674a00000000000000000000000000000000000000000000000000000000)
                    revert(ptr, 0x4) //revert TransferBlocked
                }
            }
        }
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    /**
     * @dev Overrides of super class function. Used to emit SBT events.
     * See {IERC721Upgradeable}
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override virtual {
        {
            bytes32 eventHashLocked = bytes32(keccak256("Locked(uint256)"));
            bytes32 eventHashUnlocked = bytes32(keccak256("Unlocked(uint256)"));
            assembly {
                let eventHash := eventHashLocked
                if iszero(to) {
                    eventHash := eventHashUnlocked
                }
                mstore(0x80, firstTokenId)
                log1(0x80, 32, eventHash)
            }
            
        }
        super._afterTokenTransfer(from, to, firstTokenId, batchSize);
    }

    /**
     * @dev See {IERC5192}
     */
    function locked(uint256 tokenId) external view override returns(bool result) {
        address owner = ERC721Upgradeable.ownerOf(tokenId);
        result = true;
        assembly {
            if iszero(owner) {
                result := false
            }
        }
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function totalSupply() external view override returns(uint){
        return _tokenIdCounter.current();
    }
    
    /**
     * @dev See {ISoulboundNFT}
     */
    function getTrustedSignerAddresses() external view override returns(address[] memory) {
        uint length = _trustedSigners.length();
        address[] memory list = new address[](length);
        for (uint i; i < length;) {
            list[i] = _trustedSigners.at(i);
            unchecked { ++i; }
        }

        return list;
    }

    /**
     * @notice Check characters of SBTType
     * @dev Reject transaction if SBTType is invalid
     * @param sbtType SBT Type
     */
    function isValidSBTType(string calldata sbtType) private view returns(bool) {
        bool isValid = bytes(sbtType).length != 0;
        if (!_sbtTypes.contains(sbtType) && isValid) {
            bytes memory charSet = bytes(sbtType);
            for (uint i; i < charSet.length && isValid;) {
                if (!(charSet[i] >= 0x61 && charSet[i] <= 0x7a) 
                    && !(charSet[i] >= 0x30 && charSet[i] <= 0x39)
                    && charSet[i] != 0x2d) {
                        isValid = false;
                }
                unchecked { ++i; }
            }
        }
        return isValid;
    }

    /**
     * @notice Add a new SBT type
     * @dev Only the owner can add
     * @param sbtType new type to be added
     */
    function addSBTType(string calldata sbtType) internal {
        if (!_sbtTypes.contains(sbtType))
            _sbtTypes.add(sbtType);

    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function claimSBT(
        address did,
        SBTInfo calldata sbtInfo,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external override returns(uint) {
        {
            if (!isValidSBTType(sbtInfo.sbtType)) {
                revert InvalidSBTInfo(true, false, false);
            }

            if (bytes(sbtInfo.uniqueId).length == 0) {
                revert InvalidSBTInfo(false, true, false);
            }

            if (bytes(sbtInfo.sbtURI).length == 0) {
                revert InvalidSBTInfo(false, false, true);
            }
        }
        
        {
            bytes memory params = abi.encodePacked(
                did,
                sbtInfo.sbtType,
                sbtInfo.uniqueId,
                sbtInfo.sbtURI,
                sbtInfo.recipient);

            params = abi.encodePacked(
                params,
                sbtInfo.signedData,
                sbtInfo.signedProof
            );
            
            verifyRequest(did, params, requestSignature, requestProof);

            string memory strDID = StringsUpgradeable.toHexString(uint256(uint160(did)));
            params = abi.encodePacked(
                sbtInfo.sbtType,
                "-",
                sbtInfo.uniqueId,
                "-",
                strDID
            );
            verifyData(params, sbtInfo.signedData, sbtInfo.signedProof);
        }

        if (_userInfo[sbtInfo.recipient][sbtInfo.sbtType][sbtInfo.uniqueId] != 0) {
            revert InvalidSBTInfo(true, false, false);
        }

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _userInfo[sbtInfo.recipient][sbtInfo.sbtType][sbtInfo.uniqueId] = tokenId;

        _tokenIdInfo[tokenId].sbtType = sbtInfo.sbtType;
        _tokenIdInfo[tokenId].uniqueId = sbtInfo.uniqueId;

        _userTokenIds[sbtInfo.recipient].add(tokenId);

        addSBTType(sbtInfo.sbtType);

        _safeMint(sbtInfo.recipient, tokenId);
        _setTokenURI(tokenId, sbtInfo.sbtURI);
        
        emit SBTClaimed(sbtInfo.recipient, tokenId, sbtInfo.sbtType);
        // Freeze Metadata
        emit PermanentURI(sbtInfo.sbtURI, tokenId);

        return tokenId;
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function getClaimedSBTList(address didAddress) external view override returns(uint[] memory) {
        uint length = balanceOf(didAddress);
        uint[] memory sbtList = new uint[](length);

        for (uint i; i < length;) {
            sbtList[i] = _userTokenIds[didAddress].at(i);
            unchecked { ++i; }
        }
        return sbtList;
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function isSBTClaimed(address claimer, string calldata sbtType, string calldata uniqueId) external view override returns(bool) {
        return _userInfo[claimer][sbtType][uniqueId] > 0;
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function tokenInfo(uint tokenId) external view override returns(string memory, string memory) {
        _requireMinted(tokenId);

        return (_tokenIdInfo[tokenId].sbtType, _tokenIdInfo[tokenId].uniqueId);
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function burnSBT(uint tokenId) external override {
        address tokenOwner = ERC721Upgradeable.ownerOf(tokenId);
        if (msg.sender != tokenOwner && msg.sender != owner()) {
            revert NoPermission();
        }

        TokenInfo storage info = _tokenIdInfo[tokenId];

        // Remove from user' tokenId list
        _userTokenIds[tokenOwner].remove(tokenId);

        delete _userInfo[tokenOwner][info.sbtType][info.uniqueId];
        delete _tokenIdInfo[tokenId];

        _burn(tokenId);
        emit SBTBurnt(msg.sender, tokenId);
    }

}