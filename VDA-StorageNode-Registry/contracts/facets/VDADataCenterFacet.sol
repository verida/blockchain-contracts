// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibCommon } from "../libraries/LibCommon.sol";
import { LibDataCenter } from "../libraries/LibDataCenter.sol";
import { LibUtils } from "../libraries/LibUtils.sol";
import { IDataCenter } from "../interfaces/IDataCenter.sol";

// import "hardhat/console.sol";

error InvalidDataCenterId(uint id);
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
  function copyDataCenterInput(uint id, DatacenterInput calldata from, LibDataCenter.DataCenter storage to) internal virtual {
      to.id = id;
      to.name = from.name;
      to.countryCode = from.countryCode;
      to.regionCode = from.regionCode;
      to.lat = from.lat;
      to.long = from.long;
      to.status = LibCommon.EnumStatus.active;
  }

  /**
    * @dev see { IDataCenter }
    */
  function addDataCenter(DatacenterInput calldata data) external virtual override returns(uint) {
    LibDiamond.enforceIsContractOwner();
    LibDataCenter.DataCenterStorage storage ds = LibDataCenter.dataCenterStorage();
    {
        if (bytes(data.name).length == 0 || 
          !LibUtils.isLowerCase(data.name) ||
          ds._dataCenterNameToID[data.name] != 0) {
            revert InvalidDataCenterName(data.name);
        }

        LibUtils.validateCountryCode(data.countryCode);
        LibUtils.validateRegionCode(data.regionCode);
        LibUtils.validateGeoPosition(data.lat, data.long);
    }

    uint datacenterId = ++ds._datacenterIdCounter;
    
    copyDataCenterInput(datacenterId, data, ds._dataCenterMap[datacenterId]);
    ds._dataCenterNameToID[data.name] = datacenterId;

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
    LibDataCenter.DataCenter storage datacenter = LibDataCenter.dataCenterStorage()._dataCenterMap[datacenterId];

    if (datacenter.nodeCount != 0) {
        revert HasDependingNodes();
    }
    
    string memory name = datacenter.name;
    datacenter.status = LibCommon.EnumStatus.removed;
    
    emit RemoveDataCenter(datacenterId, name);
  }

  /**
    * @dev see { IDataCenter }
    */
  function removeDataCenter(uint datacenterId) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibDataCenter.checkDataCenterIdActive(datacenterId);
    _removeDataCenter(datacenterId);
  }

  /**
    * @dev see { IDataCenter }
    */
  function removeDataCenterByName(string calldata name) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibDataCenter.DataCenterStorage storage ds = LibDataCenter.dataCenterStorage();
    uint id = ds._dataCenterNameToID[name];
    if (id == 0 || ds._dataCenterMap[id].status != LibCommon.EnumStatus.active) {
        revert InvalidDataCenterName(name);
    }
    _removeDataCenter(id);
  }
  
  /**
    * @dev see { IDataCenter }
    */
  function isRegisteredDataCenterName(string calldata name) external view virtual override returns(bool) {
    return LibDataCenter.dataCenterStorage()._dataCenterNameToID[name] != 0;
  }

  /**
    * @dev see { IDataCenter }
    */
  function getDataCenters(uint[] calldata ids) external view virtual override returns(LibDataCenter.DataCenter[] memory) {
    LibDataCenter.DataCenterStorage storage ds = LibDataCenter.dataCenterStorage();
    uint maxID = ds._datacenterIdCounter;

    uint count = ids.length;
    LibDataCenter.DataCenter[] memory list = new LibDataCenter.DataCenter[](count);
    for (uint i; i < count;) {
        if (ids[i] < 1 || ids[i] > maxID) {
            revert InvalidDataCenterId(ids[i]);
        }
        list[i] = ds._dataCenterMap[ids[i]];
        unchecked { ++i; }            
    }
    return list;
  }

  /**
    * @dev see { IDataCenter }
    */
  function getDataCentersByName(string[] calldata names) external view virtual override returns(LibDataCenter.DataCenter[] memory) {
    LibDataCenter.DataCenterStorage storage ds = LibDataCenter.dataCenterStorage();
    uint count = names.length;
    uint id;
    LibDataCenter.DataCenter[] memory list = new LibDataCenter.DataCenter[](count);
    for (uint i; i < count;) {
        id = ds._dataCenterNameToID[names[i]];
        if (id == 0) {
            revert InvalidDataCenterName(names[i]);
        }
        list[i] = ds._dataCenterMap[id];
        unchecked { ++i; }
    }
    return list;
  }

  /**
   * @notice Get all data centers for inputed ids
   * @param ids Array of data center ids
   * @return LibDataCenter.DataCenter[] Array of data centers
   */
  function getAllDataCenters(EnumerableSet.UintSet storage ids) internal view virtual returns(LibDataCenter.DataCenter[] memory) {
    LibDataCenter.DataCenterStorage storage ds = LibDataCenter.dataCenterStorage();
    uint count = ids.length();

    LibDataCenter.DataCenter[] memory list = new LibDataCenter.DataCenter[](count);
    for (uint i; i < count;) {
        list[i] = ds._dataCenterMap[ids.at(i)];
        unchecked { ++i; }
    }
    return list;
  }

  /**
   * @notice Get data centers for inputed ids
   * @param status Statua of data centers to be returned
   * @param ids Array of data center ids
   * @return LibDataCenter.DataCenter[] Array of data centers
   */
  function filterDataCenters(EnumerableSet.UintSet storage ids, LibCommon.EnumStatus status) internal view virtual returns(LibDataCenter.DataCenter[] memory) {
    LibDataCenter.DataCenterStorage storage ds = LibDataCenter.dataCenterStorage();
    uint count = ids.length();
    uint size;
    for (uint i; i < count;) {
      if(ds._dataCenterMap[ids.at(i)].status == status) {
        unchecked {
          ++size;
        }
      }
      unchecked { ++i; }
    }

    uint index;
    LibDataCenter.DataCenter[] memory list = new LibDataCenter.DataCenter[](size);
    for (uint i; i < count;) {
      if(ds._dataCenterMap[ids.at(i)].status == status) {
        list[index] = ds._dataCenterMap[ids.at(i)];
        unchecked {
          ++index;
        }
      }
      unchecked { ++i; }
    }
    return list;
  }

  /**
    * @dev see { IDataCenter }
    */
  function getDataCentersByCountry(string calldata countryCode) external view virtual override returns(LibDataCenter.DataCenter[] memory) {
    LibUtils.validateCountryCode(countryCode);
    
    LibDataCenter.DataCenterStorage storage ds = LibDataCenter.dataCenterStorage();
    return getAllDataCenters(ds._countryDataCenterIds[countryCode]);
  }

  /**
    * @dev see { IDataCenter }
    */
  function getDataCentersByCountryAndStatus(string calldata countryCode, LibCommon.EnumStatus status) external view virtual override returns(LibDataCenter.DataCenter[] memory) {
    LibUtils.validateCountryCode(countryCode);
    
    LibDataCenter.DataCenterStorage storage ds = LibDataCenter.dataCenterStorage();
    return filterDataCenters(ds._countryDataCenterIds[countryCode], status);
  }

  /**
    * @dev see { IDataCenter }
    */
  function getDataCentersByRegion(string calldata regionCode) external view virtual override returns(LibDataCenter.DataCenter[] memory) {
    LibUtils.validateRegionCode(regionCode);
    LibDataCenter.DataCenterStorage storage ds = LibDataCenter.dataCenterStorage();

    return getAllDataCenters(ds._regionDataCenterIds[regionCode]);
  }

  /**
    * @dev see { IDataCenter }
    */
  function getDataCentersByRegionAndStatus(string calldata regionCode, LibCommon.EnumStatus status) external view virtual override returns(LibDataCenter.DataCenter[] memory) {
    LibUtils.validateRegionCode(regionCode);
    LibDataCenter.DataCenterStorage storage ds = LibDataCenter.dataCenterStorage();

    return filterDataCenters(ds._regionDataCenterIds[regionCode], status);
  }
}
