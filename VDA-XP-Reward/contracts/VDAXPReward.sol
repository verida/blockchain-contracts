//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import { VDAVerificationContract } from "@verida/vda-verification-contract/contracts/VDAVerificationContract.sol";
import { IVDAXPReward } from "./IVDAXPReward.sol";
import { DateTime } from "./DateTime.sol";

// import "hardhat/console.sol";

contract VDAXPReward is IVDAXPReward, VDAVerificationContract{
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    /** RewardToken : ERC20 contract */
    IERC20Upgradeable internal rewardToken;

    /** Denominator for rate values */
    uint internal rateDenominator;

    /** XP - VDA conversion rate */
    uint internal conversionRate; // XP to VDA token rate

    /**
     * @notice Used to check that a `signature` is used once per month
     */
    mapping(bytes => bool) internal isClaimedSignature;

    /** Used to check that user claim only once for same `typeId` */
    mapping(bytes => bool) internal isClaimedTypeId;

    /** Used to check that the combination of `typeId` and `uniqueId` is claimed before*/
    mapping(bytes => bool) internal isClaimedUniqueId;

    /**
     * @notice Gap for later use
     */
    uint256[20] private __gap;

    // Custom errors
    error InvalidValue();
    error InvalidConversionRate();
    error EmptyClaimData();
    error InvalidXP(address didAddress, string typeId, uint xp);
    error InvalidProofTime(address didAddress, string typeId, uint16 year, uint8 month);
    error InsufficientTokenAmount(uint requestedAmount, uint currentAmount);
    error DuplicatedRequest(address didAddress, string typeId, uint xp, bytes signature);
    error DuplicatedUniqueId(address didAddress, string typeId, string uniqueId, uint xp);

    function __VDAXPReward_init(IERC20Upgradeable token) public initializer {
        __VDAVerificationContract_init();
        __VDAXPReward_init_unchained(token);
    }

    function __VDAXPReward_init_unchained(IERC20Upgradeable token) internal {
        rewardToken = token;
        rateDenominator = 10000000; // Set up rate from 0.000001
    }

    /**
     * @dev See {IVDAXPReward}
     */
    function getTokenAddress() external virtual view override returns(address) {
        return address(rewardToken);
    }

    /**
     * @dev See {IVDAXPReward}
     */
    function getRateDenominator() external virtual view override returns(uint) {
        return rateDenominator;
    }

    /**
     * @dev See {IVDAXPReward}
     */
    function setRateDenominator(uint denominator) external virtual override onlyOwner {
        if (rateDenominator == denominator || denominator == 0) {
            revert InvalidValue();
        }
        uint orgVal = rateDenominator;
        rateDenominator = denominator;
        emit UpdateRateDenominator(orgVal, denominator);
    }

    /**
     * @dev See {IVDAXPReward}
     */
    function getConversionRate() external virtual view override returns(uint) {
        return conversionRate;
    }

    /**
     * @dev See {IVDAXPReward}
     */
    function setConversionRate(uint newRate) external virtual override onlyOwner {
        if (newRate == 0 || newRate == conversionRate) {
            revert InvalidValue();
        }
        uint orgVal = conversionRate;
        conversionRate = newRate;
        emit UpdateConversionRate(orgVal, newRate);
    }

    /**
     * @notice Validate the time of proof
     * @dev Separated for `stack too deep`
     * @param didAddress - DID address. Used to revert
     * @param curTime - Current time
     * @param info - Claim information
     */
    function _validateProofTime(address didAddress, DateTime._DateTime memory curTime, ClaimInfo calldata info) internal virtual view {
        if (curTime.month == 1) {
            if (curTime.year != (info.issueYear + 1) || info.issueMonth != 12) {
                revert InvalidProofTime(didAddress, info.typeId, info.issueYear, info.issueMonth);
            }
        } else if (curTime.year != info.issueYear || curTime.month != (info.issueMonth + 1)) {
            revert InvalidProofTime(didAddress, info.typeId, info.issueYear, info.issueMonth);
        }
    }

    /**
     * @notice Check the proofs and return the total amount of XP
     * @param didAddress - DID address
     * @param infos - Array of claim requests
     * @return uint - Total amount of requested claim
     */
    function _validateClaimSignature(address didAddress, ClaimInfo[] calldata infos) internal virtual returns(uint) {
        uint totalXP;

        bytes memory rawMsg;

        uint infoLen = infos.length;
        DateTime._DateTime memory curTime = DateTime.parseTimestamp(block.timestamp);

        for (uint i; i < infoLen;) {
            if (infos[i].xp == 0) {
                revert InvalidXP(didAddress, infos[i].typeId, infos[i].xp);
            }
            // Check the time of proof issued
            _validateProofTime(didAddress, curTime, infos[i]);

            rawMsg = abi.encodePacked(didAddress, infos[i].typeId, infos[i].issueYear, infos[i].issueMonth);
            
            // Check whether `typeId` is claimed in this month
            if (isClaimedTypeId[rawMsg]) {
                revert DuplicatedRequest(didAddress, infos[i].typeId, infos[i].xp, infos[i].signature);
            }
            isClaimedTypeId[rawMsg] = true;

            if (bytes(infos[i].uniqueId).length != 0) {
                rawMsg = abi.encodePacked(infos[i].typeId, infos[i].uniqueId);
                // Check whether `uniqueId` is claimed before
                if (isClaimedUniqueId[rawMsg]) {
                    revert DuplicatedUniqueId(didAddress, infos[i].typeId, infos[i].uniqueId, infos[i].xp);
                }
                isClaimedUniqueId[rawMsg] = true;

                rawMsg = abi.encodePacked(didAddress, rawMsg, infos[i].issueYear, infos[i].issueMonth, infos[i].xp);
                
            } else {
                rawMsg = abi.encodePacked(rawMsg, infos[i].xp);
                // Check `Proof` is claimed
                if (isClaimedSignature[infos[i].signature]) {
                    revert DuplicatedRequest(didAddress, infos[i].typeId, infos[i].xp, infos[i].signature);
                }
                isClaimedSignature[infos[i].signature] = true;

            }

            // Validate the signature
            verifyData(rawMsg, infos[i].signature, infos[i].proof);
            
            totalXP = totalXP + infos[i].xp;
            unchecked {++i;}
        }

        return totalXP;
    }

    /**
     * @dev See {IVDAXPReward}
     */
    function claimXPReward(
        address didAddress, 
        address to,
        ClaimInfo[] calldata claims,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external virtual override {
        if (conversionRate == 0) {
            revert InvalidConversionRate();
        }
        if (claims.length == 0) {
            revert EmptyClaimData();
        }

        // Verify Request
        {
            bytes memory params = abi.encodePacked(didAddress, to);
            uint length = claims.length;
            for (uint i; i < length;) {
                params = abi.encodePacked(params, claims[i].signature);
                unchecked {
                    ++i;
                }
            }
            verifyRequest(didAddress, params, requestSignature, requestProof);
        }

        // Verify proofs
        uint totalXP = _validateClaimSignature(didAddress, claims);
        uint rewardAmount = totalXP * conversionRate / rateDenominator;
        uint curBalance = rewardToken.balanceOf(address(this));

        if ( curBalance < rewardAmount) {
            revert InsufficientTokenAmount(rewardAmount, curBalance);
        }

        rewardToken.transfer(to, rewardAmount);

        emit ClaimedXPReward(didAddress, to, rewardAmount, conversionRate, rateDenominator);
    }

    /**
     * @dev See {IVDAXPReward}
     */
    function withdraw(address to, uint amount) external virtual override onlyOwner {
        rewardToken.transfer(to, amount);
    }
}