// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface ISoulboundNFT {
    /**
     * @notice SBT information
     * @dev Used for input data types on claiming SBT
     * @param sbtType Existing SBT type
     * @param uniqueId Unique id of SBT. For example twitter account id.
     * @param sbtURI Token URI to be set
     * @param recipient Token receiver
     * @param signedData Signature of `uniqueId`. Signed by the trusted signer
     * @param signedProof Proof for `uniqudId`
     */
    struct SBTInfo {
        string sbtType;
        string uniqueId;
        string sbtURI;
        address recipient;
        bytes signedData;
        bytes signedProof;
    }

    /**
     * @notice TokenId information
     * @dev Used to keep token information
     * @param sbtType Existing SBT type
     * @param uniqueId Unique id of SBT. For example twitter account id.
     */
    struct TokenInfo {
        string sbtType;
        string uniqueId;
    }

    /**
     * @notice emitted when a user claimed a SBT
     * @param to address that claims the SBT
     * @param tokenId claimed SBT id inside the contract
     * @param sbtType SBT type
     */
    event SBTClaimed(address indexed to, uint tokenId, string sbtType);

    /**
     * @notice emitted whan a SBT is burnt
     * @param who address that burn the SBT. This can the token owner or contract owner
     * @param tokenId Burnt SBT id
     */
    event SBTBurnt(address indexed who, uint tokenId);

    /**
     * @notice Freeze metadata
     * @dev This events is from docs.opensea.io/docs/metadata-standards
     * @param _value token URI - SBT URI
     * @param _id token ID - SBT ID
     */
    event PermanentURI(string _value, uint256 indexed _id);

    /**
     * @notice Get total supply of token
     * @dev Only owner can see this
     * @return uint Total supplyf of SBT tokens
     */
    function totalSupply() external view returns(uint);


    /**
     * @notice Get list of company accounts 
     * @dev Only owner can see this
     * @return address[] list of company accounts
     */
    function getTrustedSignerAddresses() external view returns(address[] memory);

    // /**
    //  * @notice Remove a existing SBT type
    //  * @dev Only the owner can remove
    //  * @param sbtType existing type to be removed
    //  */
    // function removeSBTType(string calldata sbtType) external;

    /**
     * @notice Claim a SBT type to requested user
     * @dev Claim to msg.sender
     * @param did `did` of requesting user. Used for verification
     * @param sbtInfo SBT Information
     * @param requestSignature Signature signed by did
     * @param requestProof Proof provided by Verida-server
     * @return uint Claimed tokenId
     */
    function claimSBT(
        address did,
        SBTInfo calldata sbtInfo,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external returns(uint);

    /**
     * @notice SBT owner burn their claimed token or Contract owner burn a specific SBT
     * @dev SBT owner('recipient' wallet in the SBTInfo) can burn it.
     * Contract owner burn a specific SBT when it's against policy
     * @param tokenId Claimed token Id
     */
    function burnSBT(
        uint tokenId
    ) external;

    /**
     * @notice Get claimed SBT list of user
     * @dev Get the list of msg.sender
     * @return uint[] Claimed token Id list
     */
    function getClaimedSBTList() external view returns(uint[] memory);

    /**
     * @notice Check whether user claimed the sbtType
     * @dev Check for msg.sender
     * @param sbtType existing SBT type
     * @param uniqueId Unique id of SBT. For example twitter account id.
     * @return bool true if claimed, otherwise false
     */
    function isSBTClaimed(string calldata sbtType, string calldata uniqueId) external view returns(bool);
    
    /**
     * @notice Get the SBT type & uniqueID from a tokenId
     * @param tokenId minted token ID
     * @return string SBT type of tokenId
     * @return string UniqueId of tokenId 
     */
    function tokenInfo(uint tokenId) external view returns(string memory, string memory);
}