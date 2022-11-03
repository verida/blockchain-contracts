// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

import "@verida/vda-verification-contract/contracts/VDAVerificationContract.sol";
import "@verida/name-registry/contracts/EnumerableSet.sol";

import "./IERC5192.sol";
import "./ISoulboundNFT.sol";

contract SoulboundNFT is VDAVerificationContract, 
    ERC721Upgradeable, 
    ERC721URIStorageUpgradeable, 
    IERC5192, 
    ISoulboundNFT {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using EnumerableSet for EnumerableSet.StringSet;

    CountersUpgradeable.Counter private _tokenIdCounter;

    /**
     * @notice SBT types of Verida
     */
    EnumerableSet.StringSet private _sbtTypes;

    /**
     * @notice Claimed SBT info by SBT type
     * @dev mapping of SBTType => (claimed wallet => bool)
     */
    mapping(string => mapping(address => bool)) private _claimedData;

    /**
     * @notice Claimed SBT info by users
     * @dev Used to allow one sbt per type
     */
    mapping(address => mapping(string => bool)) private _userInfo;

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
        __ERC721_init("Solbound-NFT", "VSBT");
        __ERC721URIStorage_init();
        __VDAVerificationContract_init();
    }

    // The following functions are overrides required by Solidity.
    /**
     * @dev burn a NFT
     * @param tokenId tokenId to be burnt
     */
    function _burn(uint256 tokenId)
        internal
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
    {
        super._burn(tokenId);
    }

    /**
     * @dev returns the token uri of tokenId
     * @param tokenId tokenId minted
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
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
    function addSBTType(string calldata sbtType) external onlyOwner override {
        require(!_sbtTypes.contains(sbtType), "Already registered");
        _sbtTypes.add(sbtType);

        emit AddSBTType(sbtType);
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function removeSBTType(string calldata sbtType) external onlyOwner override {
        require(_sbtTypes.contains(sbtType), "Not registered type");
        _sbtTypes.remove(sbtType);

        emit RemoveSBTType(sbtType);
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function allowedSBTTypes() external view override returns(string[] memory) {
        // To-do
        uint length = _sbtTypes.length();

        string[] memory sbtTypeList = new string[](length);

        for (uint i = 0; i < length; i++) {
            sbtTypeList[i] = _sbtTypes.at(i);
        }

        return sbtTypeList;
    }

    /**
     * @dev See {IsoulboundNFT}
     */
    function claimSBT(
        address did,
        string calldata sbtType,
        string calldata uniqueId,
        bytes calldata signature,
        bytes calldata proof
    ) external override returns(uint) {
        // To-do
        uint didNonce = getNonce(did);
        bytes memory params = abi.encodePacked(
            sbtType,
            uniqueId,
            didNonce
        );

        verifyRequest(did, params, signature, proof);

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, "Custom URI of token");

    }

    /**
     * @dev See {IsoulboundNFT}
     */
    function getClaimedSBTList() external view override returns(string[] memory) {
        // To-do

    }

    /**
     * @dev See {IsoulboundNFT}
     */
    function isSBTClaimed(string calldata sbtType) external view override returns(bool) {
        // To-do
    }

    /**
     * @dev See {IsoulboundNFT}
     */
    function tokenSBTType(uint tokenId) external view override returns(string memory) {
        // To-do
    }
}