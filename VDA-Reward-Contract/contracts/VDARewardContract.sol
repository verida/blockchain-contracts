//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./IVDARewardContract.sol";
import { VeridaDataVerificationLib } from "./VeridaDataVerificationLib.sol";

contract VDARewardContract is OwnableUpgradeable, IVDARewardContract {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    /** ReardToken : ERC20 contract */
    IERC20Upgradeable rewardToken;

    /** Mapping of claim ID => claim Type */
    mapping(string => ClaimType) private claimTypes;

    /** Mapping of claim ID => Verida account */
    mapping(bytes => bool) private claims;

    /** Trusted address */
    EnumerableSetUpgradeable.AddressSet private trustedAddressList;

    modifier onlyExistingClaimType(string calldata typeId) {
        ClaimType storage claimType = claimTypes[typeId];
        require(claimType.reward > 0 && bytes(claimType.schema).length > 0, "Non existing CalimType");
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
        require(bytes(typeId).length > 0, "Invalid id");
        require(rewardAmount > 0, "Invalid reward amount");
        require(bytes(schema).length > 0, "Invalid schema");
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
        require(amount > 0, "Invalid reward amount");
        ClaimType storage claimType = claimTypes[typeId];
        claimType.reward = amount;

        emit UpdateClaimTypeReward(typeId, amount);
    }

    /**
     * @dev see {IVDARewardContract-addTrustedAddress}
     */
    function addTrustedAddress(address did) external onlyOwner {
        require(!trustedAddressList.contains(did), "Already existing");
        trustedAddressList.add(did);

        emit AddTrustedAddress(did);
    }

    /**
     * @dev see {IVDARewardContract-removeTrustedAddress}
     */
    function removeTrustedAddress(address did) external onlyOwner {
        require(trustedAddressList.contains(did), "Not existing");
        trustedAddressList.remove(did);

        emit RemoveTrustedAddress(did);
    }

    /**
     * @dev Check whether address is in trustedAddressList. Only owner can call.
     * @param did - DID address to check
     */
    function isTrustedAddress(address did) external view onlyOwner returns(bool) {
        return trustedAddressList.contains(did);
    }

    /**
     * @dev see {IVDARewardContract-claim}
     */
    function claim(string calldata typeId, string calldata hash, bytes calldata proof, address to) external onlyExistingClaimType(typeId) {
        ClaimType storage claimType = claimTypes[typeId];
        bytes memory proofMessage = abi.encodePacked(
            hash,
            "|",
            claimType.schema
        );
        require(!claims[proofMessage], "Already claimed");

        address signer = VeridaDataVerificationLib.getSignerAddress(
            proofMessage,
            proof
        );
        require(trustedAddressList.contains(signer), "Invalid signer");

        require(rewardToken.balanceOf(address(this)) >= claimType.reward, "Insufficient token in contract");

        claims[proofMessage] = true;
        rewardToken.transfer(to, claimType.reward);
    }
} 