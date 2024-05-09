import { BytesLike } from "ethers"

/**
 * @notice This interface is part of `ClaimInfo` struct of `VDAXPReward` contract
 */
export interface ClaimData {
    proofType: string
    issueYear: number
    issueMonth: number
    xp: number
}

/**
 * @notice This interface is the same as `ClaimInfo` struct of `VDAXPReward` contract
 */
export interface ClaimInfo extends ClaimData {
    proof: BytesLike
}

/**
 * @notice XP value is invalid
 */
export const CLAIM_INVALID_XP : ClaimData = {
    proofType: 'gamer31-campaign1',
    issueYear: 2024,
    issueMonth: 4,
    xp: 0,
}

/**
 * @notice Valid claim data
 * @dev `issueYear` and `issueMonth` should be the same as the current time
 */
export const CLAIM_GAMER31: ClaimData = {
    proofType: 'gamer31-campaign1',
    issueYear: 2024,
    issueMonth: 4,
    xp: 10,
}

/**
 * @notice Valid claim data
 * @dev `issueYear` and `issueMonth` should be the same as the current time
 */
export const CLAIM_ZKPASS: ClaimData = {
    proofType: 'zkpass-binance-kyc',
    issueYear: 2024,
    issueMonth: 4,
    xp: 10,
}