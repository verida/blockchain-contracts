// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "@verida/vda-verification-contract/contracts/VDAVerificationContract.sol";
import "@verida/name-registry/contracts/EnumerableSet.sol";

import "./IERC5192.sol";
import "./ISoulboundNFT.sol";

import "hardhat/console.sol";

contract SoulboundNFT is VDAVerificationContract, 
    IERC721MetadataUpgradeable,
    ERC721Upgradeable, 
    IERC5192, 
    ISoulboundNFT {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using EnumerableSet for EnumerableSet.StringSet;

    /**
     * @notice Verida wallets that provide proof
     * @dev Only owner can mange this list
     */
    EnumerableSetUpgradeable.AddressSet private _companyAccounts;

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
     * @notice Claimed SBT info by SBT type
     * @dev mapping of SBTType => (user => tokenId)
     */
    mapping(string => mapping(address => uint)) private _sbtInfo;

    // /**
    //  * @notice Claimed SBT info by users
    //  * @dev Used to allow one sbt per type
    //  */
    // mapping(address => mapping(string => bool)) private _userInfo;

    /** 
     * @notice SBT type of tokenId
     */
    mapping(uint => string) private _tokenSBTType;

    modifier onlyValidSBTType(string calldata sbtType) {
        require(_sbtTypes.contains(sbtType), "Invalid SBT type");
        _;
    }

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
        override(IERC721MetadataUpgradeable, ERC721Upgradeable)
        returns (string memory)
    {
        return ERC721Upgradeable.tokenURI(tokenId);
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
        require(!_companyAccounts.contains(account), "Existing account");
        _companyAccounts.add(account);

        emit AddTrustedAddress(account);
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function removeTrustedAddress(address account) external onlyOwner override {
        require(_companyAccounts.contains(account), "Invalid account");
        _companyAccounts.remove(account);

        emit RemoveTrustedAddress(account);
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function getTrustedAddresses() external view override returns(address[] memory) {
        uint length = _companyAccounts.length();
        address[] memory list = new address[](length);
        for (uint i = 0; i < length; i++) {
            list[i] = _companyAccounts.at(i);
        }

        return list;
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    function addSBTType(string calldata sbtType) external onlyOwner override {
        require(!_sbtTypes.contains(sbtType), "Existing SBT type");
        _sbtTypes.add(sbtType);

        emit AddSBTType(sbtType);
    }

    /**
     * @dev See {ISoulboundNFT}
     */
    /*
    function removeSBTType(string calldata sbtType) external onlyOwner override {
        require(_sbtTypes.contains(sbtType), "Not registered type");
        _sbtTypes.remove(sbtType);

        emit RemoveSBTType(sbtType);
    }
    */

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
    ) external onlyValidSBTType(sbtType) override returns(uint) {
        require(_sbtInfo[sbtType][msg.sender] == 0, "Already claimed type");
        
        {
            address stackDID = did;
            uint didNonce = getNonce(did);
            bytes memory params = abi.encodePacked(
                sbtType,
                "-",
                uniqueId,
                "-",
                stackDID,
                "-",
                didNonce
            );
            verifyRequest(did, params, signature, proof);
        }

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        _safeMint(msg.sender, tokenId);

        _sbtInfo[sbtType][msg.sender] = tokenId;
        _tokenSBTType[tokenId] = sbtType;

        emit SBTClaimed(msg.sender, tokenId, sbtType);

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
            if (_sbtInfo[sbtType][msg.sender] != 0) {
                sbtList[index] = sbtType;
                index++;
            }
        }
        return sbtList;
    }

    /**
     * @dev See {IsoulboundNFT}
     */
    function isSBTClaimed(string calldata sbtType) external view onlyValidSBTType(sbtType) override returns(bool) {
        return _sbtInfo[sbtType][msg.sender] > 0;
    }

    /**
     * @dev See {IsoulboundNFT}
     */
    function tokenSBTType(uint tokenId) external view override returns(string memory) {
        _requireMinted(tokenId);

        return _tokenSBTType[tokenId];
    }

    /**
     * @dev Override function of VDA-Verification-Base/VDAVerificationContract.sol
     */
    function verifyRequest(address did, bytes memory params, bytes calldata signature, bytes calldata proof) internal override {
        require(_companyAccounts.length() > 0, "No company accounts");

        bytes32 paramsHash = keccak256(params);
        address paramSigner = ECDSAUpgradeable.recover(paramsHash, signature);

        bool isVerified = false;
        uint index = 0;

        while (index < _companyAccounts.length() && !isVerified) {
            address account = _companyAccounts.at(index);
            bytes memory proofString = abi.encodePacked(
                account,
                '-',
                paramSigner
            );
            bytes32 proofHash = keccak256(proofString);
            address proofSigner = ECDSAUpgradeable.recover(proofHash, proof);

            if (proofSigner == account){
                isVerified = true;
                break;
            }
            index++;
        }

        require(isVerified, "Invalid proof");
        nonce[did]++;
    }
}