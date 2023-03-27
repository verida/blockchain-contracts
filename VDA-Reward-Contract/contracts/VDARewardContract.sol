//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./IVDARewardContract.sol";

import "@verida/vda-verification-contract/contracts/VDAVerificationContract.sol";

contract VDARewardContract is IVDARewardContract, VDAVerificationContract {

    /** ReardToken : ERC20 contract */
    IERC20Upgradeable rewardToken;

    /** Mapping of claim ID => claim Type */
    mapping(string => ClaimType) private claimTypes;

    /** Mapping of claim ID => Verida account */
    mapping(bytes => bool) private claims;

    modifier onlyExistingClaimType(string calldata typeId) {
        ClaimType storage claimType = claimTypes[typeId];
        require(claimType.reward != 0 && bytes(claimType.schema).length != 0, "Non existing CalimType");
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
    function addClaimType(string calldata typeId, uint rewardAmount, string calldata schema) external onlyOwner {
        require(bytes(typeId).length != 0, "Invalid id");
        require(rewardAmount != 0, "Invalid reward amount");
        require(bytes(schema).length != 0, "Invalid schema");
        ClaimType storage claimType = claimTypes[typeId];
        require(claimType.reward == 0 && bytes(claimType.schema).length == 0, "Already existing ClaimType");
        claimType.reward = rewardAmount;
        claimType.schema = schema;

        emit AddClaimType(typeId, rewardAmount, schema);
    }

    /**
     * @dev see {IVDARewardContract-removeClaimType}
     */
    function removeClaimType(string calldata typeId) external onlyOwner onlyExistingClaimType(typeId){
        delete claimTypes[typeId];

        emit RemoveClaimType(typeId);
    }

    /**
     * @dev see {IVDARewardContract-updateClaimTypeReward}
     */
    function updateClaimTypeReward(string calldata typeId, uint amount) external onlyOwner onlyExistingClaimType(typeId){
        require(amount != 0, "Invalid reward amount");
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
        require(!claims[rawMsg], "Already claimed");

        verifyData(rawMsg, signature, proof);
        
        require(rewardToken.balanceOf(address(this)) >= claimType.reward, "Insufficient token in contract");

        claims[rawMsg] = true;
        rewardToken.transfer(to, claimType.reward);
    }
} 