// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface ISoulboundNFT {
    /**
     * @notice SBT information
     * @param sbtType Existing SBT type
     * @param uniqueId Unique id of SBT. Forexample twitter account id.
     * @param sbtURI Token URI to be set
     * @param recipient Token receiver
     */
    struct SBTInfo {
        string sbtType;
        string uniqueId;
        string sbtURI;
        address recipient;
    }

    /**
     * @notice emitted when a user claimed a SBT
     * @param to address that claims the SBT
     * @param tokenId claimed SBT id inside the contract
     * @param sbtType SBT type
     */
    event SBTClaimed(address indexed to, uint tokenId, string sbtType);

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
     * @param signature Signature signed by did
     * @param proof Proof provided by Verida-server
     * @return uint Claimed tokenId
     */
    function claimSBT(
        address did,
        SBTInfo calldata sbtInfo,
        bytes calldata signature,
        bytes calldata proof
    ) external returns(uint);

    /**
     * @notice Get claimed SBT type list of user
     * @dev Get the list of msg.sender
     * @return string[] SBT types array
     */
    function getClaimedSBTList() external view returns(string[] memory);

    /**
     * @notice Check whether user claimed the sbtType
     * @dev Check for msg.sender
     * @param sbtType existing SBT type
     * @return bool true if claimed, otherwise false
     */
    function isSBTClaimed(string calldata sbtType) external view returns(bool);
    
    /**
     * @notice Get the SBT type of tokenId
     * @param tokenId minted token ID
     * @return string SBT type assigned to tokenId
     */
    function tokenSBTType(uint tokenId) external view returns(string memory);
}