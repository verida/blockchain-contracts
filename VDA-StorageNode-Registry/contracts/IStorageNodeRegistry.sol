//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IStorageNodeRegistry {

    /**
     * @notice Struct representing a data center
     * @dev `id` starts from 1. If `id` is 0, it means removed.
     * @param id Data center Id
     * @param name Data center name
     * @param countryCode Unique two-character string code
     * @param regionCode Unique region string code
     * @param lat Latitude
     * @param long Longitude
     */
    struct Datacenter {
        string name;
        string countryCode;
        string regionCode;
        int lat;
        int long;
    }

    /**
     * @notice Struct representing a storage node
     * @param didAddress DID address that is associated with the storage node
     * @param endpointUri The storage node endpoint
     * @param countryCode Unique two-character string code
     * @param regionCode Unique region string code
     * @param datacenterId Unique datacenter identifier that is created by `addDataCenter()` method.
     * @param lat Latitude
     * @param long Longitude
     * @param slotCount Number of slots indicationg how many storage slots the node will provide
     * @param establishmentDate Node added time in seconds
     */
    struct StorageNode {
        address didAddress;
        string endpointUri;
        string countryCode;
        string regionCode;
        uint datacenterId;
        int lat;
        int long;
        uint slotCount;
        uint establishmentDate;
    }

    /**
     * @notice Struct for StorageNodeInput
     * @dev Used in `addNode()` function
     * @param didAddress DID address that is associated with the storage node
     * @param endpointUri The storage node endpoint
     * @param countryCode Unique two-character string code
     * @param regionCode Unique region string code
     * @param datacenterId Unique datacenter identifier that is created by `addDataCenter()` method.
     * @param lat Latitude
     * @param long Longitude
     * @param slotCount Number of slots indicationg how many storage slots the node will provide
     */
    struct StorageNodeInput {
        address didAddress;
        string endpointUri;
        string countryCode;
        string regionCode;
        uint datacenterId;
        int lat;
        int long;
        uint slotCount;
    }

    /**
     * @notice Emitted when a datacenter added
     * @param datacenterId Added datacenterId
     * @param name Datacenter name
     * @param countryCode Unique two-character string code
     * @param regionCode Unique region string code
     * @param lat Latitude
     * @param long Longitude
     */
    event AddDataCenter(
        uint indexed datacenterId,
        string indexed name,
        string countryCode,
        string regionCode,
        int lat,
        int long
    );

    /**
     * @notice Emitted when a datacenter removed
     * @param datacenterId datacenterId to be removed
     */
    event RemoveDataCenter(uint indexed datacenterId);

    /**
     * @notice Emitted when a storage node added
     * @param didAddress DID address that is associated with the storage node
     * @param endpointUri The storage node endpoint
     * @param countryCode Unique two-character string code
     * @param regionCode Unique region string code
     * @param datacenterId Unique datacenter identifier that is created by `addDataCenter()` method.
     * @param slotCount Number of slots indicationg how many storage slots the node will provide
     * @param establishmentDate Node added time in seconds
     */
    event AddNode(
        address indexed didAddress, 
        string indexed endpointUri,
        string countryCode,
        string regionCode,
        uint datacenterId,
        int lat,
        int long,
        uint slotCount,
        uint establishmentDate
    );

    /**
     * @notice Emitted when a removing node is requested
     * @param didAddress DID address that is to be removed from the network
     * @param unregisterDateTime The unix timestamp of when the storage node should no logner be available for selection.
        Must be at leaset 28 dayse in the future from calling function point
     */
    event RemoveNodeStart(address indexed didAddress, uint unregisterDateTime);

    /**
     * @notice Emitted when a removing node is completed
     * @param didAddress DID address that is to be removed from the network
     */
    event RemoveNodeComplete(address indexed didAddress);

    /**
     * @notice Emitted when the `isStakingRequired` value of `_slotInfo` is updated
     * @param newVal New value updated
     */
    event UpdateStakingRequired(bool newVal);

    /**
     * @notice Emitted when the `STAKE_PER_SLOT` value of `_slotInfo` is updated
     * @param newVal New value updated
     */
    event UpdateStakePerSlot(uint newVal);

    /**
     * @notice Emitted when the `MIN_SLOTS` value of `_slotInfo` is updated
     * @param newVal New value updated
     */
    event UpdateMinSlotCount(uint newVal);

    /**
     * @notice Emitted when the `MAX_SLOTS` value of `_slotInfo` is updated
     * @param newVal New value updated
     */
    event UpdateMaxSlotCount(uint newVal);

    /**
     * @notice Emitted when the excess tokens are withdrawn
     * @param didAddress DID address
     * @param to Token receiving address
     * @param amount Withdrawn amount
     */
    event TokenWithdrawn(address indexed didAddress, address to, uint amount);

    /**
     * @notice Emitted when the tokens are deposited
     * @param didAddress DID address
     * @param from Wallet address from which tokens are deposited
     * @param amount Deposited amount
     */
    event TokenDeposited(address indexed didAddress, address from, uint amount);

    /**
     * @notice Emitted when the Verida token address is updated
     * @param oldAddress Original token address
     * @param newAddress Updated address
     */
    event UpdateTokenAddress(address oldAddress, address newAddress);

    /**
     * @notice Emitted when the NODE_ISSUE_FEE updated
     * @param orgFee Original fee value
     * @param newFee Updated fee value
     */
    event UpdateNodeIssueFee(uint orgFee, uint newFee);

    /**
     * @notice Emitted when the SAME_NODE_LOG_DURATION updated
     * @param orgVal Original value
     * @param newVal Updated value
     */
    event UpdateSameNodeLogDuration(uint orgVal, uint newVal);

    /**
     * @notice Emitted when the LOG_LIMIT_PER_DAY updated
     * @param orgVal Original value
     * @param newVal Updated value
     */
    event UpdateLogLimitPerDay(uint orgVal, uint newVal);

    /**
     * @notice Emitted when user logged an node issue by `logNodeIssue()` function
     * @param from DID address that logs this issue
     * @param nodeDID DID address of the node
     * @param reasonCode Reason code
     */
    event LoggedNodeIssue(address indexed from, address nodeDID, uint reasonCode);

    /**
     * @notice Emitted when stakes VDA tokens of `nodeDID` was slashed by contract owner
     * @param nodeDID DID address of the node
     * @param reasonCode Reason code
     * @param Amount Slashed amount. This can be a bit different from the parameter of `slash()` function
     * @param rewardedCount Number of dids who received the rewards
     * @param moreInfoUrl On-chain pointer to where more information can be fournd about this slashing
     */
    event Slash(address indexed nodeDID, uint reasonCode, uint Amount, uint rewardedCount, string moreInfoUrl);

    /**
     * @notice Emitted when the contract owner withdraw tokens staked by logging issues
     * @param to Receiver address
     * @param amount Token amount to be withdrawn
     */
    event WithdrawIssueFee(address indexed to, uint amount);

    /**
     * @notice Add a data center to the network. `id` will be auto-incremented.
     * @dev Only the contract owner can call this function
     * @param data Datacenter info
     * @return datacenterId Created datacetnerId
     */
    function addDatacenter(Datacenter calldata data) external payable returns(uint);

    /**
     * @notice Remove a data center
     * @dev Only the contract owner can call this function.
     *  Will only remove the data center if there are no storage nodes using this datacenterId
     * @param datacenterId datacenterId created by `addDatacenter()` function
     */
    function removeDatacenter(uint datacenterId) external payable;

    /**
     * @notice Return an array of `Datacenter` structs for given array of datacenterIds
     * @param ids Array of datacenterIds
     * @return Datacenter[] Array of `Datacenter` structs 
     */
    function getDatacenters(uint[] calldata ids) external view returns(Datacenter[] memory);

    /**
     * @notice Return an array of `Datacenter` structs for country code
     * @param countryCode Unique two-character string code
     * @return Datacenter[] Array of `Datacenter` structs 
     */
    function getDataCentersByCountry(string calldata countryCode) external view returns(Datacenter[] memory);

    /**
     * @notice Return an array of `Datacenter` structs for region
     * @param regionCode Unique region string code
     * @return Datacenter[] Array of `Datacenter` structs 
     */
    function getDataCentersByRegion(string calldata regionCode) external view returns(Datacenter[] memory);
    
    /**
     * @notice Registers a new endpoint on the network
     * @dev A did can register only one storage-node
     * @param nodeInfo Node information to be added
     * @param requestSignature The request parameters signed by the `didAddress` private key
     * @param requestProof Used to verify request
     * @param authSignature Signature signed by a trusted signer
     */
    function addNode(
        StorageNodeInput calldata nodeInfo,
        bytes calldata requestSignature,
        bytes calldata requestProof,
        bytes calldata authSignature
    ) external;

    /**
     * @notice Unregister a storage node from the network at the specified date
     * @param didAddress DID address that is to be removed from the network
     * @param unregisterDateTime The unix timestamp in secods of when the storage node should no logner be available for selection.
        Must be at leaset 28 dayse in the future from calling function point
     * @param requestSignature The request parameters signed by the `didAddress` private key
     * @param requestProof Used to verify request
     */
    function removeNodeStart(
        address didAddress,
        uint unregisterDateTime,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external;

    /**
     * @notice Complete storage node unregisteration
     * @param didAddress DID address that is to be removed from the network
     * @param requestSignature The request parameters signed by the `didAddress` private key
     * @param requestProof Used to verify request
     */
    function removeNodeComplete(
        address didAddress,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external;

    /**
     * @notice Returns a storage node for didAddress
     * @param didAddress DID address that is associated with the storage node
     * @return StorageNode Returns storage node
     * @return string Status - "active" or "removed"
     */
    function getNodeByAddress(address didAddress) external view returns(StorageNode memory, string memory);

    /**
     * @notice Returns a storage node for endpoint uri
     * @param endpointUri The storage node endpoint
     * @return StorageNode Returns storage node
     * @return string Status - "active" or "removed"
     */
    function getNodeByEndpoint(string calldata endpointUri) external view returns(StorageNode memory, string memory);

    /**
     * @notice Return an array of `Storagenode` structs for countryCode
     * @param countryCode Unique two-character string code
     * @return StorageNode[] An array of `Storagenode` structs
     */
    function getNodesByCountry(string calldata countryCode) external view returns(StorageNode[] memory);

    /**
     * @notice Return an array of `Storagenode` structs for regionCode
     * @param regionCode Unique region string code
     * @return StorageNode[] An array of `Storagenode` structs
     */
    function getNodesByRegion(string calldata regionCode) external view returns(StorageNode[] memory);

    /**
     * @notice Returns whether staking is required to call `addNode()` function
     * @return bool The value of required status
     */
    function isStakingRequired() external view returns(bool);

    /**
     * @notice Update the `isStakingRequired` value of `_slotInfo` struct
     * @dev Only the contract owner is allowed to call this function
     * @param isRequired The new value to be updated
     */
    function setStakingRequired(bool isRequired) external payable;

    /**
     * @notice Returns the `STAKE_PER_SLOT` value of `_slotInfo` struct
     * @return uint Required token amount for one slot
     */
    function getStakePerSlot() external view returns(uint);
    
    /**
     * @notice Update the `STAKE_PER_SLOT` value of `_slotInfo` struct
     * @dev Only the contract owner is allowed to call this function
     * @param newVal The new value to be updated
     */
    function updateStakePerSlot(uint newVal) external payable;

    /**
     * @notice Return the range of `slotCount` value by pair of minimum and maximum value
     * @dev Return the `MinSlots` and `MaxSlots` value of `_slotInfo` struct
     * @return uint available minimum value of `slotCount`
     * @return uint available maximum value of `slotCount`
     */
    function getSlotCountRange() external view returns(uint, uint);

    /**
     * @notice Update the `MIN_SLOTS` value of `_slotInfo` struct
     * @dev Only the contract owner is allowed to call this function
     * @param minSlots The new value to be updated
     */
    function updateMinSlotCount(uint minSlots) external payable;

    /**
     * @notice Update the `MAX_SLOTS` value of `_slotInfo` struct
     * @dev Only the contract owner is allowed to call this function
     * @param maxSlots The new value to be updated
     */
    function updateMaxSlotCount(uint maxSlots) external payable;

    /**
     * @notice Update the Verida token contract address
     * @dev Only the contract owner is allowed to call this function
     * @param newTokenAddress New token contract address
     */
    function updateTokenAddress(address newTokenAddress) external payable;

    /**
     * @notice Returns the amount of staked token.
     * @dev Will return 0 for unregistered dids
     * @param didAddress DID address that addedn a storage node
     * @return uint Amount of staked token
     */
    function getBalance(address didAddress) external view returns(uint);

    /**
     * @notice Returns the amount of excess tokens. This happens when the `STAKE_PER_SLOT` value decreased or increased
     * @param didAddress DID address
     * @return int Excess token amount. 0 if no excess tokens
     */
    function excessTokenAmount(address didAddress) external view returns(int);

    /**
     * @notice Withdraw amount of tokens to the requestor
     * @dev Will send tokens to the `tx.origin`
     * @param didAddress DID address
     * @param amount Token amount to be withdrawn
     * @param requestSignature The request parameters signed by the `didAddress` private key
     * @param requestProof Used to verify request
     */
    function withdraw(
        address didAddress, 
        uint amount,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external;

    /**
     * @notice Depoist verida tokens to the didAddress
     * @dev Work for only the registered DIDs
     * @param didAddress DID address
     * @param tokenAmount Depositing amount of Verida token
     */
    function depositToken(address didAddress, uint tokenAmount) external;

    /**
     * @notice Get current `NODE_ISSUE_FEE`
     * @return uint value of `_slotInfo.NODE_ISSUE_FEE`
     */
    function getNodeIssueFee() external view returns(uint);

    /**
     * @notice Update the `NODE_ISSUE_FEE` in the _slotInfo.
     * @param value New fee value to be set.
     */
    function updateNodeIssueFee(uint value) external payable;

    /**
     * @notice Return the current token amount staked by logging issues
     * @return uint Amount of VDA tokens for issues
     */
    function getTotalIssueFee() external view returns(uint);

    /**
     * @notice Withdraw the VDA tokens that was deposited by `logNodeIssue()` function
     * @dev Only the contract owner can withdraw fees
     * @param to Receiving address
     * @param amount Amount to be withdrawn
     */
    function withdrawIssueFee(address to, uint amount) external payable;

    /**
     * @notice Return the current same node log duration
     * @return uint Same node log duration in seconds
     */
    function getSameNodeLogDuration() external view returns(uint);

    /**
     * @notice Update the `SAME_NODE_LOG_DURATION` value
     * @dev Only the contract owner call call this function
     * @param value Time in seconds unit
     */
    function updateSameNodeLogDuration(uint value) external payable;

    /**
     * @notice Return the current log limit per day
     * @return uint Log limit count per day
     */
    function getLogLimitPerDay() external view returns(uint);

    /**
     * @notice Update the `LOG_LIMIT_PER_DAY` value
     * @dev Only the contract owner call call this function
     * @param value Log limit count per day
     */
    function updateLogLimitPerDay(uint value) external payable;

    /**
     * @notice Log an issue
     * @param didAddress DID who logs this issue
     * @param nodeAddress DIDAddress of the node
     * @param reasonCode reason code of the issue
     * @param requestSignature The request parameters signed by the `didAddress` private key
     * @param requestProof Used to verify request
     */
    function logNodeIssue(
        address didAddress,
        address nodeAddress,
        uint reasonCode,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external;

    /**
     * @notice Slash the tokens
     * @dev Only the contract owner can call this
     * @param nodeDID DID address that points the node to be slashed
     * @param reasonCode Reascon code to be slashed
     * @param amount Token amount to be slashed
     * @param moreInfoUrl On-chain pointer to where more information can be fournd about this slashing
     */
    function slash(
        address nodeDID,
        uint reasonCode,
        uint amount,
        string calldata moreInfoUrl
    ) external payable;

    
}