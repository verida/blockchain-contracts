//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IVDAXPReward {
    /**
     * @notice Claim information
     * @param typeId - Type. Ex: 'gamer31'
     * @param uniqueId - Unique Id. Optional Ex : ''.
     * @param issueYear - Issued year of `signature`
     * @param issueMonth - Issued month of `signature` : 1 - 12
     * @param xp - Value of xp
     * @param signature - Msg signed by a context signer
     * @param proof - Proof that signature was verified by the trusted address
     */
    struct ClaimInfo {
        string typeId;
        string uniqueId;
        uint16 issueYear;
        uint8 issueMonth; 
        uint xp;
        bytes signature;
        bytes proof;
    }

    /**
     * @notice Emitted when the denominator for rate value is updated
     * @param orgVal - Original value
     * @param newVal - Updated value
     */
    event UpdateRateDenominator(uint orgVal, uint newVal);

    /**
     * @notice Emitted when the XP-VDA conversion rate updated
     * @param orgRate - Original rate
     * @param newRate - Updated rate
     */
    event UpdateConversionRate(uint orgRate, uint newRate);

    /**
     * @notice Emitted when reward claimd
     * @param didAddress - DID address that requested this claim
     * @param recipient - Address that receives the reward token
     * @param rewardAmount - Total token amount rewarded
     * @param conversionRate - XP to Token conversion rate
     * @param denominator - Denominator for conversion rate value
     */
    event ClaimedXPReward(
        address didAddress,
        address recipient,
        uint rewardAmount, 
        uint conversionRate, 
        uint denominator
    );

    /**
     * @notice Returns the Reward token address (= Verida Token address)
     * @return address Token address initialized in the deployment
     */
    function getTokenAddress() external view returns(address);

    /**
     * @notice Get the denominator for rate values
     * @return uint Denominator value
     */
    function getRateDenominator() external view returns(uint);

    /**
     * @notice Set the denominator for rate values
     * @dev This is the same as `DECIMAL` in the standard `ERC-20` contract.
     *      If you need to allow 2 decimals of precision, then you can set the `rateDenominator` as 100.
     *      In case, the `conversionRate` value of 15 means the 0.15.
     *      Default value is 10000000. Can set up rate from 0.000001.
     * @dev Only the contract owenr is allowed to call this function
     * @param denominator - new value to be set
     */
    function setRateDenominator(uint denominator) external;

    /**
     * @notice Get the current XP-VDA conversion rate
     * @return uint - XP-VDA conversion rate value set by the contract owner
     */
    function getConversionRate() external view returns(uint);

    /**
     * @notice Update the XP-VDA conversion rate
     * @param newRate - New value to be updated
     */
    function setConversionRate(uint newRate) external;

    /**
     * @notice Claim XP rewards
     * @param didAddress - DID address that request this claim
     * @param to - Reward recipient address
     * @param requestSignature - Used to verify request
     * @param requestProof - Used to verify request
     */
    function claimXPReward(
        address didAddress, 
        address to,
        ClaimInfo[] calldata claims,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external;

    /**
     * @notice Withdraw tokens
     * @dev Only the contract owner allowed
     * @param to - Recipient wallet address
     * @param amount - Token amount to be withdrawn
     */
    function withdraw(address to, uint amount) external;
}