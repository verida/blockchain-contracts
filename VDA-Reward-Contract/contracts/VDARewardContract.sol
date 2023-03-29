//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./IVDARewardContract.sol";

import "@verida/vda-verification-contract/contracts/VDAVerificationContract.sol";

error InvalidId();
error InvalidRewardAmount();
error InvalidSchema();
error DuplicatedRequest();
error InsufficientTokenAmount();

contract VDARewardContract is IVDARewardContract, VDAVerificationContract {

    /** ReardToken : ERC20 contract */
    IERC20Upgradeable rewardToken;

    /** Mapping of claim ID => claim Type */
    mapping(string => ClaimType) private claimTypes;

    /** Mapping of claim ID => Verida account */
    mapping(bytes => bool) private claims;

    modifier onlyExistingClaimType(string calldata typeId) {
        ClaimType storage claimType = claimTypes[typeId];
        if (claimType.reward == 0 || bytes(claimType.schema).length == 0) {
            revert InvalidId();
        }
        _;
    }

    function __VDARewardContract_init(IERC20Upgradeable token) public initializer {
        __Ownable_init();
        __VDARewardContract_init_unchained(token);
    }

    function __VDARewardContract_init_unchained(IERC20Upgradeable token) internal {
        rewardToken = token;
    }

    /**
     * @dev see {IVDARewardContract-getClaimType}
     */
    function getClaimType(string calldata typeId) external view onlyExistingClaimType(typeId) returns(uint reward, string memory schema) {
        ClaimType storage claimType = claimTypes[typeId];
        reward = claimType.reward;
        schema = claimType.schema;
    }

    /**
     * @dev see {IVDARewardContract-addClaimType}
     */
    function addClaimType(string calldata typeId, uint rewardAmount, string calldata schema) external payable onlyOwner {
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
    function removeClaimType(string calldata typeId) external payable onlyOwner onlyExistingClaimType(typeId){
        delete claimTypes[typeId];

        emit RemoveClaimType(typeId);
    }

    /**
     * @dev see {IVDARewardContract-updateClaimTypeReward}
     */
    function updateClaimTypeReward(string calldata typeId, uint amount) external payable onlyOwner onlyExistingClaimType(typeId){
        if (amount == 0) {
            revert InvalidRewardAmount();
        }
        ClaimType storage claimType = claimTypes[typeId];
        claimType.reward = amount;

        emit UpdateClaimTypeReward(typeId, amount);
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
    ) external onlyExistingClaimType(typeId) {

        ClaimType storage claimType = claimTypes[typeId];
        bytes memory rawMsg = abi.encodePacked(
            hash,
            "|",
            claimType.schema
        );
        if (claims[rawMsg]) {
            revert DuplicatedRequest();
        }

        verifyData(rawMsg, signature, proof);
        
        if (rewardToken.balanceOf(address(this)) < claimType.reward) {
            revert InsufficientTokenAmount();
        }

        claims[rawMsg] = true;
        rewardToken.transfer(to, claimType.reward);
    }
} 