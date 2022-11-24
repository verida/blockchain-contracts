// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface ISoulboundNFT {
    /**
     * @notice emitted when a company account added
     * @param account Company account added
     */
    event AddTrustedAddress(address account);

    /**
     * @notice emitted when a company account removed
     * @param account Company account removed
     */
    event RemoveTrustedAddress(address account);

    // /**
    //  * @notice emitted when a new SBT type added
    //  * @param sbtType Added SBT type
    //  */
    // event AddSBTType(string indexed sbtType);

    /**
     * @notice emitted when a SBT type removed
     * @param sbtType Removed SBT type
     */
    // event RemoveSBTType(string indexed sbtType);

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
     * @notice Add Verida account that provides proof to users
     * @dev Only owner can do this
     * @param account Company account to be added
     */
    function addTrustedAddress(address account) external;

    /**
     * @notice Remove Verida account that provides proof to users
     * @dev Only owner can do this
     * @param account Company account to be removed
     */
    function removeTrustedAddress(address account) external;

    /**
     * @notice Get list of company accounts 
     * @dev Only owner can see this
     * @return address[] list of company accounts
     */
    function getTrustedAddresses() external view returns(address[] memory);

    // /**
    //  * @notice Remove a existing SBT type
    //  * @dev Only the owner can remove
    //  * @param sbtType existing type to be removed
    //  */
    // function removeSBTType(string calldata sbtType) external;

    /**
     * @notice Return the list of registered SBT types
     * @dev Anyone can request this
     * @return string[] SBT types array
     */
    function allowedSBTTypes() external view returns(string[] memory);

    /**
     * @notice Claim a SBT type to requested user
     * @dev Claim to msg.sender
     * @param did `did` of requesting user. Used for verification
     * @param sbtType Existing SBT type
     * @param uniqueId Unique id of SBT. Forexample twitter account id.
     * @param signature Signature signed by did
     * @param sbtURI Token URI to be set
     * @param recipient Token receiver
     * @param proof Proof provided by Verida-server
     * @return uint Claimed tokenId
     */
    function claimSBT(
        address did,
        string calldata sbtType,
        string calldata uniqueId,
        string calldata sbtURI,
        address recipient,
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