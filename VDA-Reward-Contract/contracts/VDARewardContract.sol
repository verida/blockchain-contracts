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

    /** Trusted signing addresses (these are DID context public keys in address format) */
    EnumerableSetUpgradeable.AddressSet private trustedAddressList;

    modifier onlyExistingClaimType(string calldata id) {
        ClaimType storage claimType = claimTypes[id];
        require(claimType.reward > 0 && bytes(claimType.schema).length > 0, "ClaimType does not exist");
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
    function getClaimType(string calldata id) external view onlyExistingClaimType(id) returns(uint reward, string memory schema) {
        ClaimType storage claimType = claimTypes[id];
        reward = claimType.reward;
        schema = claimType.schema;
    }

    /**
     * @dev see {IVDARewardContract-addClaimType}
     */
    function addClaimType(string calldata id, uint rewardAmount, string calldata schema) external onlyOwner {
        require(bytes(id).length > 0, "Invalid id");
        require(rewardAmount > 0, "Invalid reward amount");
        require(bytes(schema).length > 0, "Invalid schema");
        ClaimType storage claimType = claimTypes[id];
        require(claimType.reward == 0 && bytes(claimType.schema).length == 0, "ClaimType already exists");
        claimType.reward = rewardAmount;
        claimType.schema = schema;

        emit AddClaimType(id, rewardAmount, schema);
    }

    /**
     * @dev see {IVDARewardContract-removeClaimType}
     */
    function removeClaimType(string calldata id) external onlyOwner onlyExistingClaimType(id){
        delete claimTypes[id];

        emit RemoveClaimType(id);
    }

    /**
     * @dev see {IVDARewardContract-updateClaimTypeReward}
     */
    function updateClaimTypeReward(string calldata id, uint amount) external onlyOwner onlyExistingClaimType(id){
        require(amount > 0, "Invalid reward amount");
        ClaimType storage claimType = claimTypes[id];
        claimType.reward = amount;

        emit UpdateClaimTypeReward(id, amount);
    }

    /**
     * @dev see {IVDARewardContract-addTrustedAddress}
     */
    function addTrustedAddress(address did) external onlyOwner {
        require(!trustedAddressList.contains(did), "Trusted address already exists");
        trustedAddressList.add(did);

        emit AddTrustedAddress(did);
    }

    /**
     * @dev see {IVDARewardContract-removeTrustedAddress}
     */
    function removeTrustedAddress(address did) external onlyOwner {
        require(trustedAddressList.contains(did), "Trusted address doesn't exist");
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
    function claim(string calldata id, string calldata hash, bytes calldata proof, address to) external onlyExistingClaimType(id) {
        ClaimType storage claimType = claimTypes[id];
        bytes memory proofMessage = abi.encodePacked(
            hash,
            "|",
            claimType.schema
        );
        require(!claims[proofMessage], "Unique claim already processed");

        address signer = VeridaDataVerificationLib.getSignerAddress(
            proofMessage,
            proof
        );
        require(trustedAddressList.contains(signer), "Proof signed by untrusted DID");

        require(rewardToken.balanceOf(address(this)) >= claimType.reward, "Insufficient tokens");

        claims[proofMessage] = true;
        rewardToken.transfer(to, claimType.reward);
    }
} 