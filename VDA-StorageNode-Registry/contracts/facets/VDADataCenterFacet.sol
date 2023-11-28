// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibDataCenter } from "../libraries/LibDataCenter.sol";
import { LibUtils } from "../libraries/LibUtils.sol";
import { IDataCenter } from "../interfaces/IDataCenter.sol";

error InvalidDataCenterName(string name);
error HasDependingNodes();

contract VDADataCenterFacet is IDataCenter {
  using EnumerableSet for EnumerableSet.UintSet;

  /**
    * @notice Copy DatacenterInput struct to Datacenter
    * @dev Used inside the `addDataCenter()`
    * @param id Data center ID that is created automatically
    * @param from DatacenterInput struct
    * @param to Datacenter struct
    */
  function copyDataCenterInput(uint id, DatacenterInput calldata from, LibDataCenter.Datacenter storage to) internal virtual {
      to.id = id;
      to.name = from.name;
      to.countryCode = from.countryCode;
      to.regionCode = from.regionCode;
      to.lat = from.lat;
      to.long = from.long;
  }

  /**
    * @dev see { IDataCenter }
    */
  function addDataCenter(DatacenterInput calldata data) external virtual override returns(uint) {
    LibDiamond.enforceIsContractOwner();
    LibDataCenter.DiamondStorage storage ds = LibDataCenter.diamondStorage();
    {
        if (bytes(data.name).length == 0 || !LibUtils.isLowerCase(data.name)) {
            revert InvalidDataCenterName(data.name);
        }

        if (ds._dataCenterNameToID[data.name] != 0) {
            revert InvalidDataCenterName(data.name);
        }

        LibUtils.validateCountryCode(data.countryCode);
        LibUtils.validateRegionCode(data.regionCode);
        LibUtils.validateGeoPosition(data.lat, data.long);
    }

    ++ds._datacenterIdCounter;
    uint datacenterId = ds._datacenterIdCounter;

    copyDataCenterInput(datacenterId, data, ds._dataCenterMap[datacenterId]);
    ds._dataCenterNameToID[data.name] = datacenterId;
    
    ds._datacenterInfo[datacenterId].isActive = true;

    ds._countryDataCenterIds[data.countryCode].add(datacenterId);
    ds._regionDataCenterIds[data.regionCode].add(datacenterId);

    emit AddDataCenter(datacenterId, data.name, data.countryCode, data.regionCode, data.lat, data.long);

    return datacenterId;
  }

  /**
    * @notice Internal function used to remove a datacenter
    * @param datacenterId Datacenter id
    */
  function _removeDataCenter(uint datacenterId) internal virtual {
    LibDataCenter.DiamondStorage storage ds = LibDataCenter.diamondStorage();
    if (ds._datacenterInfo[datacenterId].nodeCount != 0) {
        revert HasDependingNodes();
    }

    LibDataCenter.Datacenter storage datacenter = ds._dataCenterMap[datacenterId];
    string memory name = datacenter.name;
    
    ds._countryDataCenterIds[datacenter.countryCode].remove(datacenterId);
    ds._regionDataCenterIds[datacenter.regionCode].remove(datacenterId);
    delete ds._dataCenterNameToID[datacenter.name];
    delete ds._dataCenterMap[datacenterId];
    delete ds._datacenterInfo[datacenterId];

    emit RemoveDataCenter(datacenterId, name);
  }

  /**
    * @dev see { IDataCenter }
    */
  function removeDataCenter(uint datacenterId) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibDataCenter.checkDataCenterIdExistance(datacenterId);
    _removeDataCenter(datacenterId);
  }

  /**
    * @dev see { IDataCenter }
    */
  function removeDataCenterByName(string calldata name) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibDataCenter.DiamondStorage storage ds = LibDataCenter.diamondStorage();
    uint id = ds._dataCenterNameToID[name];
    if (id == 0) {
        revert InvalidDataCenterName(name);
    }
    _removeDataCenter(id);
  }
  
  /**
    * @dev see { IDataCenter }
    */
  function isDataCenterNameRegistered(string calldata name) external view virtual override returns(bool) {
    return LibDataCenter.isDataCenterNameRegistered(name);
  }

  /**
    * @dev see { IDataCenter }
    */
  function getDataCenters(uint[] calldata ids) external view virtual override returns(LibDataCenter.Datacenter[] memory) {
    return LibDataCenter.getDataCenters(ids);
  }

  /**
    * @dev see { IDataCenter }
    */
  function getDataCentersByName(string[] calldata names) external view virtual override returns(LibDataCenter.Datacenter[] memory) {
    return LibDataCenter.getDataCentersByName(names);
  }

  /**
    * @dev see { IDataCenter }
    */
  function getDataCentersByCountry(string calldata countryCode) external view virtual override returns(LibDataCenter.Datacenter[] memory) {
    LibUtils.validateCountryCode(countryCode);
    return LibDataCenter.getDataCentersByCountry(countryCode);
  }

  /**
    * @dev see { IDataCenter }
    */
  function getDataCentersByRegion(string calldata regionCode) external view virtual override returns(LibDataCenter.Datacenter[] memory) {
    LibUtils.validateRegionCode(regionCode);
    return LibDataCenter.getDataCentersByRegion(regionCode);
  }
}
