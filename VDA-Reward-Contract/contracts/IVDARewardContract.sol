//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IVDARewardContract {
    struct ClaimType {
        uint reward;
        string schema;
    }

    /**
     * @dev Emitted when claimed successfully
     * @param typeId - Unique ID of the ClaimType.
     * @param hash - Uniquie hash from the credential
     * @param to - Rewarded address
     */
    event Claim(string typeId, string hash, address to);

    /**
     * @dev Emitted when claimed successfully
     * @param typeId - Unique ID of the ClaimType.
     * @param hash - Uniquie hash from the credential
     * @param didAddress - DIDAddress in the `StorageNodeRegistry` contract
     */
    event ClaimToStorage(string typeId, string hash, address didAddress);

    /**
     * @dev Emitted when owner added a new claim type.
     * @param typeId - ID of added ClaimType
     * @param rewardAmount - reward amount of added ClaimType
     * @param schema - schema of added ClaimType
     */
    event AddClaimType(string typeId, uint rewardAmount, string schema);

    /**
     * @dev Emitted when owner removed a claim type.
     * @param typeId - ID of removed ClaimType
     */
    event RemoveClaimType(string typeId);

    /**
     * @dev Emitted when owner updated the reward amount of ClaimType
     * @param typeId - Unique ID of the claim type
     * @param amount - The amount of VDAR tokens to be rewarded for successful claim
     */
    event UpdateClaimTypeReward(string typeId, uint amount);

    
    /**
     * @dev User claims reward token to targeting address
     * @param typeId - Unique ID of the ClaimType (ie: facebook)
     * @param hash - Uique hash from the credential (ie: 09c247n5t089247n90812798c14)
     * @param to - Reward token receiving address
     * @param signature - Signature from the credential that signed a combination of the hash and credential schema
     * @param proof - Proof that signature was verified by the trusted address
     
     */
    function claim(
        string calldata typeId, 
        string calldata hash, 
        address to,
        bytes calldata signature,
        bytes calldata proof        
    ) external;

    /**
     * @dev User claims reward token to the `StorageNodeRegistry` contract
     * @param typeId - Unique ID of the ClaimType (ie: facebook)
     * @param hash - Uique hash from the credential (ie: 09c247n5t089247n90812798c14)
     * @param didAddress - DIDAddress in the `StorageNodeRegistry` contract
     * @param signature - Signature from the credential that signed a combination of the hash and credential schema
     * @param proof - Proof that signature was verified by the trusted address
     */
    function claimToStorage(
        string calldata typeId, 
        string calldata hash, 
        address didAddress,
        bytes calldata signature,
        bytes calldata proof        
    ) external;

    /**
     * @dev Returns a ClaimType info
     * @param typeId - A short, lowercase, unique identifier for claim type (ie: facebook)
     * @return reward - The amount of VDAR tokens to be rewarded for successful claim.
     * @return schema - The schema URI of claim type. (ie: https://common.schemas.verida.io/social/creds/facebook)
     */
    function getClaimType(string calldata typeId) external view returns(uint reward, string memory schema);

    /**
     * @dev Add a claim type. Only owner can add.
     * @param typeId - A short, lowercase, unique identifier for claim type (ie: facebook)
     * @param rewardAmount - The amount of VDAR tokens to be rewarded for successful claim.
     * @param schema - The schema URI of claim type. (ie: https://common.schemas.verida.io/social/creds/facebook)
     */
    function addClaimType(string calldata typeId, uint rewardAmount, string calldata schema) external payable;

    /**
     * @dev Remove a claim type. Only owner can remove.
     * @param typeId - Unique ID of the claimType.
     */
    function removeClaimType(string calldata typeId) external payable;

    /**
     * @dev Update reward amount of the claim type. Only owner can update.
     * @param typeId - Unique ID of the claim type
     * @param amount - The amount of VDAR tokens to be rewarded for successful claim.
     */
    function updateClaimTypeReward(string calldata typeId, uint amount) external payable;

    /**
     * @notice Returns the Reward token address (= Verida Token address)
     * @return address Token address initialized in the deployment
     */
    function getTokenAddress() external view returns(address);

    /**
     * @notice Returns the `StorageNodeRegistry` contract address that is associated with this contract
     * @return address Address of `StorageNodeRegistry` contract
     */
    function getStorageNodeContractAddress() external view returns(address);
}