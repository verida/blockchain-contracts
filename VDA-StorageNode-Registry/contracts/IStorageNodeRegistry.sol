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
     */
    struct StorageNode {
        address didAddress;
        string endpointUri;
        string countryCode;
        string regionCode;
        uint datacenterId;
        int lat;
        int long;
    }

    // /**
    //  * @notice Additional information for a storage node
    //  * @dev Used internally inside the contract
    //  * @param expired Expired time. 0 means not expired
    //  */
    // struct StorageNodeInfo {
    //     uint expired;
    // }

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
     */
    event AddNode(
        address indexed didAddress, 
        string indexed endpointUri,
        string countryCode,
        string regionCode,
        uint datacenterId,
        int lat,
        int long
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
     * @notice Add a data center to the network. `id` will be auto-incremented.
     * @dev Only the contract owner can call this function
     * @param data Datacenter info
     * @return datacenterId Created datacetnerId
     */
    function addDatacenter(Datacenter calldata data) external returns(uint);

    /**
     * @notice Remove a data center
     * @dev Only the contract owner call call this function.
     *  Will only remove the data center if there are no storage nodes using this datacenterId
     * @param datacenterId datacenterId created by `addDatacenter()` function
     */
    function removeDatacenter(uint datacenterId) external;

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
        StorageNode calldata nodeInfo,
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
     */
    function getNodeByAddress(address didAddress) external view returns(StorageNode memory);

    /**
     * @notice Returns a storage node for endpoint uri
     * @param endpointUri The storage node endpoint
     * @return StorageNode Returns storage node
     */
    function getNodeByEndpoint(string calldata endpointUri) external view returns(StorageNode memory);

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
}