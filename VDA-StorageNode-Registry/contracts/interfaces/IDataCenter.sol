// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibCommon } from "../libraries/LibCommon.sol";
import { LibDataCenter } from "../libraries/LibDataCenter.sol";

interface IDataCenter {
  /**
    * @notice Struct representing a data center
    * @dev Removed `id` field from above `Datacenter` struct
    */
  struct DatacenterInput {
      string name;
      string countryCode;
      string regionCode;
      int lat;
      int long;
  }

  /**
    * @notice Emitted when a datacenter is added
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
    * @notice Emitted when a datacenter is removed
    * @param datacenterId Removed datacenterId
    * @param name Removed datacenter name
    */
  event RemoveDataCenter(
      uint indexed datacenterId,
      string indexed name
  );

  /**
    * @notice Add a data center to the network.
    * @dev Only the contract owner can call this function
    * @param data Datacenter info
    * @return datacenterId Created datacetnerId
    */
  function addDataCenter(DatacenterInput calldata data) external returns(uint);
  
  /**
    * @notice Remove a data center
    * @dev Only the contract owner can call this function.
    *  Will only remove the data center if there are no storage nodes using this datacenterId
    * @param datacenterId datacenterId created by `addDataCenter()` function
    */
  function removeDataCenter(uint datacenterId) external;

  /**
    * @notice Remove a data center by name
    * @dev Only the contract owner can call this function.
    *  Will only remove the data center if there are no storage nodes using this datacenterId
    * @param name datacenter name to be removed
    */
  function removeDataCenterByName(string calldata name) external;

  /**
    * @notice Check whether data center name is existing
    * @dev Return `false` for removed data center names
    * @param name datacenter name to be checked
    * @return bool `true` if data center name is existing, otherwise `false`
    */
  function isRegisteredDataCenterName(string calldata name) external view returns(bool);

  /**
    * @notice Return an array of `Datacenter` structs for given array of datacenterIds
    * @param ids Array of datacenterIds
    * @return Datacenter[] Array of `Datacenter` structs 
    */
  function getDataCenters(uint[] calldata ids) external view returns(LibDataCenter.DataCenter[] memory);

  /**
    * @notice Return a data center with the given name
    * @dev Data center names are unique in the contract
    * @param names Name list of the data centers
    * @return Datacenter[] Array of `Datacenter` structs 
    */
  function getDataCentersByName(string[] calldata names) external view returns(LibDataCenter.DataCenter[] memory);
  
  /**
    * @notice Return an array of `Datacenter` structs for country code
    * @param countryCode Unique two-character string code
    * @return Datacenter[] Array of `Datacenter` structs 
    */
  function getDataCentersByCountry(string calldata countryCode) external view returns(LibDataCenter.DataCenter[] memory);

  /**
    * @notice Return an array of `Datacenter` structs for country code 
    * @param countryCode Unique two-character string code
    * @param status Status of data centers to be returned
    * @return Datacenter[] Array of `Datacenter` structs 
    */
  function getDataCentersByCountryAndStatus(string calldata countryCode, LibCommon.EnumStatus status) external view returns(LibDataCenter.DataCenter[] memory);

  /**
    * @notice Return an array of `Datacenter` structs for region
    * @param regionCode Unique region string code
    * @return Datacenter[] Array of `Datacenter` structs 
    */
  function getDataCentersByRegion(string calldata regionCode) external view returns(LibDataCenter.DataCenter[] memory);

  /**
    * @notice Return an array of `Datacenter` structs for region
    * @param regionCode Unique region string code
    * @param status Status of data centers to be returned
    * @return Datacenter[] Array of `Datacenter` structs 
    */
  function getDataCentersByRegionAndStatus(string calldata regionCode, LibCommon.EnumStatus status) external view returns(LibDataCenter.DataCenter[] memory);
}