//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IVDARewardContract {
    struct ClaimType {
        uint reward;
        string schema;
    }

    /**
     * @dev Emitted when claimed successfully
     * @param claimId - Unique ID of the ClaimType.
     * @param hash - Uniquie hash from the credential
     * @param to - Rewarded address
     */
    event Claim(string claimId, string hash, address to);

    /**
     * @dev Emitted when owner added a new claim type.
     * @param id - ID of added ClaimType
     * @param rewardAmount - reward amount of added ClaimType
     * @param schema - schema of added ClaimType
     */
    event AddClaimType(string id, uint rewardAmount, string schema);

    /**
     * @dev Emitted when owner removed a claim type.
     * @param id - ID of removed ClaimType
     */
    event RemoveClaimType(string id);

    /**
     * @dev Emitted when owner updated the reward amount of ClaimType
     * @param id - Unique ID of the claim type
     * @param amount - The amount of VDAR tokens to be rewarded for successful claim
     */
    event UpdateClaimTypeReward(string id, uint amount);

    /**
     * @dev Emitted when owner added an address to trustedAddressList
     * @param did - Added DID address
     */
    event AddTrustedAddress(address did);

    /**
     * @dev Emitted when owner removed an address from trustedAddressList
     * @param did - Removed DID address
     */
    event RemoveTrustedAddress(address did);
    
    /**
     * @dev User claim a token reward (VDAR)
     * @param id - Unique ID of the ClaimType (ie: facebook)
     * @param hash - Uique hash from the credential (ie: 09c247n5t089247n90812798c14)
     * @param proof - Signature from the credential that signed a combination of the hash and credential schema
     * @param to - Reward token receiving address
     */
    function claim(string calldata id, string calldata hash, bytes calldata proof, address to) external;

    /**
     * @dev Returns a ClaimType info
     * @param id - A short, lowercase, unique identifier for claim type (ie: facebook)
     * @return reward - The amount of VDAR tokens to be rewarded for successful claim.
     * @return schema - The schema URI of claim type. (ie: https://common.schemas.verida.io/social/creds/facebook)
     */
    function getClaimType(string calldata id) external view returns(uint reward, string memory schema);

    /**
     * @dev Add a claim type. Only owner can add.
     * @param id - A short, lowercase, unique identifier for claim type (ie: facebook)
     * @param rewardAmount - The amount of VDAR tokens to be rewarded for successful claim.
     * @param schema - The schema URI of claim type. (ie: https://common.schemas.verida.io/social/creds/facebook)
     */
    function addClaimType(string calldata id, uint rewardAmount, string calldata schema) external;

    /**
     * @dev Remove a claim type. Only owner can remove.
     * @param id - Unique ID of the claimType.
     */
    function removeClaimType(string calldata id) external;

    /**
     * @dev Update reward amount of the claim type. Only owner can update.
     * @param id - Unique ID of the claim type
     * @param amount - The amount of VDAR tokens to be rewarded for successful claim.
     */
    function updateClaimTypeReward(string calldata id, uint amount) external;

    /**
     * @dev Add a trusted address. Only owner can add.
     * @param did - address of DID.
     */
    function addTrustedAddress(address did) external;

    /**
     * @dev Remove a trusted address. Only owner can remove.
     * @param did - address of DID.
     */
    function removeTrustedAddress(address did) external;

    


}