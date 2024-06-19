import { BytesLike } from "ethers"

/**
 * @notice This interface is part of `ClaimInfo` struct of `VDAXPReward` contract
 */
export interface ClaimData {
    typeId: string
    uniqueId: string
    issueYear: number
    issueMonth: number
    xp: number
}

/**
 * @notice This interface is the same as `ClaimInfo` struct of `VDAXPReward` contract
 */
export interface ClaimInfo extends ClaimData {
    signature: BytesLike
    proof: BytesLike
}

/**
 * @notice XP value is invalid
 */
export const CLAIM_INVALID_XP : ClaimData = {
    typeId: 'gamer31-campaign1',
    uniqueId: '',
    issueYear: 2024,
    issueMonth: 4,
    xp: 0,
}

/**
 * @notice Valid claim data
 * @dev `issueYear` and `issueMonth` should be the previous month of the block time
 */
export const CLAIM_GAMER31: ClaimData = {
    typeId: 'gamer31-campaign1',
    uniqueId: '',
    issueYear: 2024,
    issueMonth: 4,
    xp: 10,
}

/**
 * @notice Valid claim data
 * @dev `issueYear` and `issueMonth` should be the previous month of the block time
 */
export const CLAIM_ZKPASS: ClaimData = {
    typeId: 'zkpass-binance-kyc',
    uniqueId: '',
    issueYear: 2024,
    issueMonth: 4,
    xp: 10,
}