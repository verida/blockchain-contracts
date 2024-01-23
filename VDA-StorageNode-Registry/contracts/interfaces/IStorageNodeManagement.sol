// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibCommon } from "../libraries/LibCommon.sol";
import { LibStorageNode } from "../libraries/LibStorageNode.sol";

/**
 * @notice Interface to add/remove/get storage nodes
 */
interface IStorageNodeManagement {

  /**
    * @notice Struct for StorageNodeInput
    * @dev Used in `addNode()` function
    * @param name Unique name of the storage node
    * @param didAddress DID address that is associated with the storage node
    * @param endpointUri The storage node endpoint
    * @param countryCode Unique two-character string code
    * @param regionCode Unique region string code
    * @param datacenterId Unique datacenter identifier that is created by `addDataCenter()` method.
    * @param lat Latitude
    * @param long Longitude
    * @param slotCount Number of slots indicationg how many storage slots the node will provide
    * @param acceptFallbackSlots Indicates if this storage node is willing to accept data from nodes that are shutting down
    */
  struct StorageNodeInput {
    string name;
    address didAddress;
    string endpointUri;
    string countryCode;
    string regionCode;
    uint datacenterId;
    int lat;
    int long;
    uint slotCount;
    bool acceptFallbackSlots;
  }

  /**
   * @notice Information for fallback node. Used in `removeNodeStart()` function
   * @param fallbackNodeAddress DID address of the stroage node that will take responsibility for user data that isn't migrated away from this node before the unregister timestamp.
   * @param availableSlots Number of available slots of the fallback node
   * @param fallbackProofTime The time of proo generation
   * @param availableSlotsProof Proof signed by the fallback node 
   */
  struct FallbackNodeInfo {
    address fallbackNodeAddress;
    uint availableSlots;
    uint fallbackProofTime;
    bytes availableSlotsProof;
  }

  /**
    * @notice Emitted when a storage node added
    * @param name Unique name of the storage node
    * @param didAddress DID address that is associated with the storage node
    * @param endpointUri The storage node endpoint
    * @param countryCode Unique two-character string code
    * @param regionCode Unique region string code
    * @param datacenterId Unique datacenter identifier that is created by `addDataCenter()` method.
    * @param slotCount Number of slots indicationg how many storage slots the node will provide
    * @param acceptFallbackSlots Indicates if this storage node is willing to accept data from nodes that are shutting down
    * @param establishmentDate Node added time in seconds
    */
  event AddNode(
    string indexed name,
    address indexed didAddress, 
    string endpointUri,
    string countryCode,
    string regionCode,
    uint datacenterId,
    int lat,
    int long,
    uint slotCount,
    bool acceptFallbackSlots,
    uint establishmentDate
  );

  /**
    * @notice Emitted when a removing node is requested
    * @param didAddress DID address that is to be removed from the network
    * @param unregisterDateTime The unix timestamp of when the storage node should no logner be available for selection.
      Must be at leaset 28 dayse in the future from calling function point
    * @param fallbackNodeAddress DID address of the stroage node that will take responsibility for user data that isn't migrated away from this node before the unregister timestamp.
    */
  event RemoveNodeStart(address indexed didAddress, uint unregisterDateTime, address fallbackNodeAddress);

  /**
    * @notice Emitted when a removing node is completed
    * @param didAddress DID address that is to be removed from the network
    * @param fallbackNodeAddress DID address of the fallback stroage node
    * @param fundReleasedTo Address that receives the remaining fund 
    */
  event RemoveNodeComplete(address indexed didAddress, address fallbackNodeAddress, address fundReleasedTo);

  /**
   * @notice Return the noce for a DID address
   * @param did Address
   * @return uint nonce of inputed address
   */
  function nonce(address did) external view returns(uint);

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
    * @param fallbackInfo Information of fallback node
      @param requestSignature The request parameters signed by the `didAddress` private key
    * @param requestProof Used to verify request
    */
  function removeNodeStart(
      address didAddress,
      uint unregisterDateTime,
      FallbackNodeInfo calldata fallbackInfo,
      bytes calldata requestSignature,
      bytes calldata requestProof
  ) external;

  /**
    * @notice Complete storage node unregisteration. Release the remaining tokens to the `fundReleasedTo`
    * @param didAddress DID address that is to be removed from the network
    * @param fundReleasedTo Address that receives the remaining fund 
    * @param fallbackMigrationProof A message signed by the `fallbackNode` specified in the 
      original `removeNodeStart()` request confirming the migration of any remaining data has been completed.
    * @param requestSignature The request parameters signed by the `didAddress` private key
    * @param requestProof Used to verify request
    */
  function removeNodeComplete(
      address didAddress,
      address fundReleasedTo,
      bytes calldata fallbackMigrationProof,
      bytes calldata requestSignature,
      bytes calldata requestProof
  ) external;

  /**
   * @notice Check whether name is registered
   * @param name Name to be checked
   * @return bool `true` if registered, otherwise `false`
   */
  function isRegisteredNodeName(string calldata name) external view returns(bool);

  /**
   * @notice Check whether address is registered
   * @param didAddress DID address to be checked
   * @return bool `true` if registered, otherwise `false`
   */
  function isRegisteredNodeAddress(address didAddress) external view returns(bool);

  /**
   * @notice Check whether endpointUri is registered
   * @param endpointUri uri to be checked
   * @return bool `true` if registered, otherwise `false`
   */
  function isRegisteredNodeEndpoint(string calldata endpointUri) external view returns(bool);


  /**
    * @notice Returns a storage node for name
    * @param name The name of the storage node
    * @return StorageNode Returns storage node
    */
  function getNodeByName(string calldata name) external view returns(LibStorageNode.StorageNode memory);

  /**
    * @notice Returns a storage node for didAddress
    * @param didAddress DID address that is associated with the storage node
    * @return StorageNode Returns storage node
    */
  function getNodeByAddress(address didAddress) external view returns(LibStorageNode.StorageNode memory);

  /**
    * @notice Returns a storage node for endpoint uri
    * @param endpointUri The storage node endpoint
    * @return StorageNode Returns storage node
    */
  function getNodeByEndpoint(string calldata endpointUri) external view returns(LibStorageNode.StorageNode memory);

  /**
    * @notice Return an array of `Storagenode` structs for countryCode
    * @param countryCode Unique two-character string code
    * @return StorageNode[] An array of `Storagenode` structs. Reaturs all kinds of status
    */
  function getNodesByCountry(string calldata countryCode) external view returns(LibStorageNode.StorageNode[] memory);

  /**
    * @notice Return an array of `Storagenode` structs for countryCode
    * @param countryCode Unique two-character string code
    * @param status Target status to be returned
    * @return StorageNode[] An array of `Storagenode` structs with inputed status
    */
  function getNodesByCountryAndStatus(string calldata countryCode, LibCommon.EnumStatus status) external view returns(LibStorageNode.StorageNode[] memory);

  /**
    * @notice Return an array of `Storagenode` structs for regionCode
    * @param regionCode Unique region string code
    * @return StorageNode[] An array of `Storagenode` structs
    */
  function getNodesByRegion(string calldata regionCode) external view returns(LibStorageNode.StorageNode[] memory);

  /**
    * @notice Return an array of `Storagenode` structs for regionCode
    * @param regionCode Unique region string code
    * @param status Target status to be returned
    * @return StorageNode[] An array of `Storagenode` structs with inputed status
    */
  function getNodesByRegionAndStatus(string calldata regionCode, LibCommon.EnumStatus status) external view returns(LibStorageNode.StorageNode[] memory);
}