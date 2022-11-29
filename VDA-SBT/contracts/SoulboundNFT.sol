// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "@verida/vda-verification-contract/contracts/VDAVerificationContract.sol";
import "@verida/name-registry/contracts/EnumerableSet.sol";

import "./IERC5192.sol";
import "./ISoulboundNFT.sol";

import "hardhat/console.sol";

contract SoulboundNFT is VDAVerificationContract, 
    IERC721MetadataUpgradeable,
    ERC721URIStorageUpgradeable, 
    IERC5192, 
    ISoulboundNFT {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using EnumerableSet for EnumerableSet.StringSet;

    /**
     * @notice Verida wallets that provide proof
     * @dev Only owner can mange this list
     */
    EnumerableSetUpgradeable.AddressSet private _trustedAddresses;

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
     * @dev mapping of User => (SBTType => tokenId)
     */
    mapping(address => mapping(string => uint)) private _userInfo;

    /** 
     * @notice SBT type of tokenId
     */
    mapping(uint => string) private _tokenSBTType;

    

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
        uint256 tokenId
        ) internal override virtual {
        require(from == address(0), "Err: token transfer is BLOCKED");
        super._beforeTokenTransfer(from, to, tokenId);
    }

    /**
     * @dev Overrides of super class function. Used to emit SBT events.
     * See {IERC721Upgradeable}
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override virtual {
        if (to == address(0x0)) {
            emit Unlocked(tokenId);
        } else if (to != address(0xdead)) {
            emit Locked(tokenId);
        }
    }

    /**
     * @dev See {IERC5192}
     */
    function locked(uint256 tokenId) external view override returns(bool) {
        address owner = ERC721Upgradeable.ownerOf(tokenId);
        if (owner == address(0x0)) {
            return false;
        }
        return true;
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function totalSupply() external view onlyOwner override returns(uint){
        return _tokenIdCounter.current();
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function addTrustedAddress(address account) external onlyOwner override {
        require(!_trustedAddresses.contains(account), "Existing account");
        _trustedAddresses.add(account);

        emit AddTrustedAddress(account);
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function removeTrustedAddress(address account) external onlyOwner override {
        require(_trustedAddresses.contains(account), "Invalid account");
        _trustedAddresses.remove(account);

        emit RemoveTrustedAddress(account);
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function getTrustedAddresses() external view override returns(address[] memory) {
        uint length = _trustedAddresses.length();
        address[] memory list = new address[](length);
        for (uint i = 0; i < length; i++) {
            list[i] = _trustedAddresses.at(i);
        }

        return list;
    }

    /**
     * @notice Check characters of SBTType
     * @dev Reject transaction if SBTType is invalid
     * @param sbtType SBT Type
     */
    function isValidSBTType(string calldata sbtType) private view returns(bool) {
        bool isValid = true;
        if (!_sbtTypes.contains(sbtType)) {
            bytes memory charSet = bytes(sbtType);
            for (uint i = 0; i < charSet.length && isValid; i++) {
                if (!(charSet[i] >= 0x61 && charSet[i] <= 0x7a) 
                    && !(charSet[i] >= 0x30 && charSet[i] <= 0x39)
                    && charSet[i] != 0x2d)
                    isValid = false;
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
     * @dev See {IsoulboundNFT}
     */
    function claimSBT(
        address did,
        string calldata sbtType,
        string calldata uniqueId,
        string calldata sbtURI,
        address recipient,
        bytes calldata signature,
        bytes calldata proof
    ) external override returns(uint) {

        require(isValidSBTType(sbtType), "Invalid SBT type");
        {
            bytes memory params = abi.encodePacked(
                did,
                "-",
                sbtType,
                "-",
                uniqueId,
                "-");
            params = abi.encodePacked(
                params,
                sbtURI,
                "-",
                recipient,
                "-");
            params = abi.encodePacked(
                params,
                getNonce(did));
            verifyRequest(did, _trustedAddresses, params, signature, proof);
        }

        require(_userInfo[recipient][sbtType] == 0, "Already claimed type");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        _safeMint(recipient, tokenId);

        // SetTokenURI
        _setTokenURI(tokenId, sbtURI);

        _userInfo[recipient][sbtType] = tokenId;
        _tokenSBTType[tokenId] = sbtType;

        emit SBTClaimed(recipient, tokenId, sbtType);

        // Register SBTType
        addSBTType(sbtType);

        return tokenId;
    }

    /**
     * @dev See {IsoulboundNFT}
     */
    function getClaimedSBTList() external view override returns(string[] memory) {
        uint length = balanceOf(msg.sender);
        string[] memory sbtList = new string[](length);

        uint index = 0;
        string memory sbtType;
        for (uint i = 0; i < _sbtTypes.length(); i++) {
            sbtType = _sbtTypes.at(i);
            if (_userInfo[msg.sender][sbtType] != 0) {
                sbtList[index] = sbtType;
                index++;
            }
        }
        return sbtList;
    }

    /**
     * @dev See {IsoulboundNFT}
     */
    function isSBTClaimed(string calldata sbtType) external view override returns(bool) {
        return _userInfo[msg.sender][sbtType] > 0;
    }

    /**
     * @dev See {IsoulboundNFT}
     */
    function tokenSBTType(uint tokenId) external view override returns(string memory) {
        _requireMinted(tokenId);

        return _tokenSBTType[tokenId];
    }

}