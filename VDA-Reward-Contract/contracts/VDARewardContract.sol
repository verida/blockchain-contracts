//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@verida/vda-verification-contract/contracts/VDAVerificationContract.sol";
import { IStorageNode } from "./IStorageNode.sol";
import "./IVDARewardContract.sol";

contract VDARewardContract is IVDARewardContract, VDAVerificationContract {

    /** ReardToken : ERC20 contract */
    IERC20Upgradeable internal rewardToken;
    /** StorageNodeRegistry contract */
    IStorageNode internal storageNodeContract;

    /** Mapping of claim ID => claim Type */
    mapping(string => ClaimType) internal claimTypes;

    /** Mapping of claim ID => Verida account */
    mapping(bytes => bool) internal claims;

    /**
     * @notice Gap for later use
     */
    uint256[20] private __gap;

    modifier onlyExistingClaimType(string calldata typeId) {
        ClaimType storage claimType = claimTypes[typeId];
        if (claimType.reward == 0 || bytes(claimType.schema).length == 0) {
            revert InvalidId();
        }
        _;
    }

    // Custom errors
    error InvalidId();
    error InvalidRewardAmount();
    error InvalidSchema();
    error DuplicatedRequest();

    function __VDARewardContract_init(IERC20Upgradeable token, IStorageNode nodeContract) public initializer {
        __Ownable_init();
        __VDARewardContract_init_unchained(token, nodeContract);
    }

    function __VDARewardContract_init_unchained(IERC20Upgradeable token, IStorageNode nodeContract) internal {
        rewardToken = token;
        storageNodeContract = nodeContract;
    }

    /**
     * @dev see {IVDARewardContract-getClaimType}
     */
    function getClaimType(string calldata typeId) external view virtual override onlyExistingClaimType(typeId) returns(uint reward, string memory schema) {
        ClaimType storage claimType = claimTypes[typeId];
        reward = claimType.reward;
        schema = claimType.schema;
    }

    /**
     * @dev see {IVDARewardContract-addClaimType}
     */
    function addClaimType(string calldata typeId, uint rewardAmount, string calldata schema) external virtual override payable onlyOwner {
        if (bytes(typeId).length == 0) {
            revert InvalidId();
        }
        if (rewardAmount == 0) {
            revert InvalidRewardAmount();
        }
        if (bytes(schema).length == 0) {
            revert InvalidSchema();
        }
        ClaimType storage claimType = claimTypes[typeId];
        if (claimType.reward != 0 || bytes(claimType.schema).length != 0) {
            revert InvalidId();
        }

        claimType.reward = rewardAmount;
        claimType.schema = schema;

        emit AddClaimType(typeId, rewardAmount, schema);
    }

    /**
     * @dev see {IVDARewardContract-removeClaimType}
     */
    function removeClaimType(string calldata typeId) external virtual override payable onlyOwner onlyExistingClaimType(typeId){
        delete claimTypes[typeId];

        emit RemoveClaimType(typeId);
    }

    /**
     * @dev see {IVDARewardContract-updateClaimTypeReward}
     */
    function updateClaimTypeReward(string calldata typeId, uint amount) external virtual override payable onlyOwner onlyExistingClaimType(typeId){
        if (amount == 0) {
            revert InvalidRewardAmount();
        }
        ClaimType storage claimType = claimTypes[typeId];
        claimType.reward = amount;

        emit UpdateClaimTypeReward(typeId, amount);
    }

    /**
     * @notice Internal function. Verify claim request and return reward amount
     * @param typeId - Unique ID of the ClaimType (ie: facebook)
     * @param hash - Uique hash from the credential (ie: 09c247n5t089247n90812798c14)
     * @param paramAddress - Recipient address or DIDAddress
     * @param signature - Signature from the credential that signed a combination of the hash and credential schema
     * @param proof - Proof that signature was verified by the trusted address
     */
    function verifyClaimRequest(
        string calldata typeId, 
        string calldata hash, 
        address paramAddress,
        bytes calldata signature,
        bytes calldata proof
    ) internal virtual onlyExistingClaimType(typeId) returns(uint)  {
        ClaimType storage claimType = claimTypes[typeId];
        bytes memory rawMsg = abi.encodePacked(
            hash,
            "|",
            claimType.schema
        );
        if (claims[rawMsg]) {
            revert DuplicatedRequest();
        }
        claims[rawMsg] = true;

        rawMsg = abi.encodePacked(rawMsg,paramAddress);
        verifyData(rawMsg, signature, proof);

        return claimType.reward;
    }

    /**
     * @dev see {IVDARewardContract-claim}
     */
    function claim(
        string calldata typeId, 
        string calldata hash, 
        address to,
        bytes calldata signature,
        bytes calldata proof
    ) external virtual override {
        uint amount = verifyClaimRequest(typeId, hash, to, signature, proof);
        rewardToken.transfer(to, amount);
        emit Claim(typeId, hash, to);
    }

    /**
     * @dev see {IVDARewardContract-claim}
     */
    function claimToStorage(
        string calldata typeId, 
        string calldata hash, 
        address didAddress,
        bytes calldata signature,
        bytes calldata proof
    ) external virtual override {
        uint amount = verifyClaimRequest(typeId, hash, didAddress, signature, proof);
        // Call function of StorageNodeRegistry contract
        rewardToken.approve(address(storageNodeContract), amount);
        storageNodeContract.depositTokenFromProvider(didAddress, address(this), amount);

        emit ClaimToStorage(typeId, hash, didAddress);
    }

    /**
     * @dev see {IVDARewardContract-claim}
     */
    function getTokenAddress() external view returns(address) {
        return address(rewardToken);
    }

    /**
     * @dev see {IVDARewardContract-claim}
     */
    function getStorageNodeContractAddress() external view returns(address) {
        return address(storageNodeContract);
    }
} 