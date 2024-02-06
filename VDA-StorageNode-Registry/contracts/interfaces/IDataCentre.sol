// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibCommon } from "../libraries/LibCommon.sol";
import { LibDataCentre } from "../libraries/LibDataCentre.sol";

interface IDataCentre {
  /**
    * @notice Struct representing a data centre
    * @dev Removed `id` field from above `Datacentre` struct
    */
  struct DatacentreInput {
      string name;
      string countryCode;
      string regionCode;
      int lat;
      int long;
  }

  /**
    * @notice Emitted when a datacentre is added
    * @param datacentreId Added datacentreId
    * @param name Datacentre name
    * @param countryCode Unique two-character string code
    * @param regionCode Unique region string code
    * @param lat Latitude
    * @param long Longitude
    */
  event AddDataCentre(
      uint indexed datacentreId,
      string indexed name,
      string countryCode,
      string regionCode,
      int lat,
      int long
  );

  /**
    * @notice Emitted when a datacentre is removed
    * @param datacentreId Removed datacentreId
    * @param name Removed datacentre name
    */
  event RemoveDataCentre(
      uint indexed datacentreId,
      string indexed name
  );

  /**
    * @notice Add a data centre to the network.
    * @dev Only the contract owner can call this function
    * @param data Datacentre info
    * @return datacentreId Created datacetnerId
    */
  function addDataCentre(DatacentreInput calldata data) external returns(uint);
  
  /**
    * @notice Remove a data centre
    * @dev Only the contract owner can call this function.
    *  Will only remove the data centre if there are no storage nodes using this datacentreId
    * @param datacentreId datacentreId created by `addDataCentre()` function
    */
  function removeDataCentre(uint datacentreId) external;

  /**
    * @notice Remove a data centre by name
    * @dev Only the contract owner can call this function.
    *  Will only remove the data centre if there are no storage nodes using this datacentreId
    * @param name datacentre name to be removed
    */
  function removeDataCentreByName(string calldata name) external;

  /**
    * @notice Check whether data centre name is existing
    * @dev Return `false` for removed data centre names
    * @param name datacentre name to be checked
    * @return bool `true` if data centre name is existing, otherwise `false`
    */
  function isRegisteredDataCentreName(string calldata name) external view returns(bool);

  /**
    * @notice Return an array of `Datacentre` structs for given array of datacentreIds
    * @param ids Array of datacentreIds
    * @return Datacentre[] Array of `Datacentre` structs 
    */
  function getDataCentresById(uint[] calldata ids) external view returns(LibDataCentre.DataCentre[] memory);

  /**
    * @notice Return a data centre with the given name
    * @dev Data centre names are unique in the contract
    * @param names Name list of the data centres
    * @return Datacentre[] Array of `Datacentre` structs 
    */
  function getDataCentresByName(string[] calldata names) external view returns(LibDataCentre.DataCentre[] memory);
  
  /**
    * @notice Return an array of `Datacentre` structs for country code
    * @param countryCode Unique two-character string code
    * @return Datacentre[] Array of `Datacentre` structs 
    */
  function getDataCentresByCountryCode(string calldata countryCode) external view returns(LibDataCentre.DataCentre[] memory);

  /**
    * @notice Return an array of `Datacentre` structs for country code 
    * @param countryCode Unique two-character string code
    * @param status Status of data centres to be returned
    * @return Datacentre[] Array of `Datacentre` structs 
    */
  function getDataCentresByCountryAndStatus(string calldata countryCode, LibCommon.EnumStatus status) external view returns(LibDataCentre.DataCentre[] memory);

  /**
    * @notice Return an array of `Datacentre` structs for region
    * @param regionCode Unique region string code
    * @return Datacentre[] Array of `Datacentre` structs 
    */
  function getDataCentresByRegionCode(string calldata regionCode) external view returns(LibDataCentre.DataCentre[] memory);

  /**
    * @notice Return an array of `Datacentre` structs for region
    * @param regionCode Unique region string code
    * @param status Status of data centres to be returned
    * @return Datacentre[] Array of `Datacentre` structs 
    */
  function getDataCentresByRegionAndStatus(string calldata regionCode, LibCommon.EnumStatus status) external view returns(LibDataCentre.DataCentre[] memory);
}