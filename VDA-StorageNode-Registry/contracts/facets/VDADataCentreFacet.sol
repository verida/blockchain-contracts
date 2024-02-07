// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibCommon } from "../libraries/LibCommon.sol";
import { LibDataCentre } from "../libraries/LibDataCentre.sol";
import { LibUtils } from "../libraries/LibUtils.sol";
import { IDataCentre } from "../interfaces/IDataCentre.sol";

// import "hardhat/console.sol";

error InvalidDataCentreId(uint id);
error InvalidDataCentreName(string name);
error HasDependingNodes();

contract VDADataCentreFacet is IDataCentre {
  using EnumerableSet for EnumerableSet.UintSet;

  /**
    * @notice Copy DatacentreInput struct to Datacentre
    * @dev Used inside the `addDataCentre()`
    * @param id Data centre ID that is created automatically
    * @param from DatacentreInput struct
    * @param to Datacentre struct
    */
  function copyDataCentreInput(uint id, DatacentreInput calldata from, LibDataCentre.DataCentre storage to) internal virtual {
      to.id = id;
      to.name = from.name;
      to.countryCode = from.countryCode;
      to.regionCode = from.regionCode;
      to.lat = from.lat;
      to.long = from.long;
      to.status = LibCommon.EnumStatus.active;
  }

  /**
    * @dev see { IDataCentre }
    */
  function addDataCentre(DatacentreInput calldata data) external virtual override returns(uint) {
    LibDiamond.enforceIsContractOwner();
    LibDataCentre.DataCentreStorage storage ds = LibDataCentre.dataCentreStorage();
    {
        if (bytes(data.name).length == 0 || 
          !LibUtils.isLowerCase(data.name) ||
          ds._dataCentreNameToID[data.name] != 0) {
            revert InvalidDataCentreName(data.name);
        }

        LibUtils.validateCountryCode(data.countryCode);
        LibUtils.validateRegionCode(data.regionCode);
        LibUtils.validateGeoPosition(data.lat, data.long);
    }

    uint datacentreId = ++ds._datacentreIdCounter;
    
    copyDataCentreInput(datacentreId, data, ds._dataCentreMap[datacentreId]);
    ds._dataCentreNameToID[data.name] = datacentreId;

    ds._countryDataCentreIds[data.countryCode].add(datacentreId);
    ds._regionDataCentreIds[data.regionCode].add(datacentreId);

    emit AddDataCentre(datacentreId, data.name, data.countryCode, data.regionCode, data.lat, data.long);

    return datacentreId;
  }

  /**
    * @notice Internal function used to remove a datacentre
    * @param datacentreId Datacentre id
    */
  function _removeDataCentre(uint datacentreId) internal virtual {
    LibDataCentre.DataCentre storage datacentre = LibDataCentre.dataCentreStorage()._dataCentreMap[datacentreId];

    if (datacentre.nodeCount != 0) {
        revert HasDependingNodes();
    }
    
    string memory name = datacentre.name;
    datacentre.status = LibCommon.EnumStatus.removed;
    
    emit RemoveDataCentre(datacentreId, name);
  }

  /**
    * @dev see { IDataCentre }
    */
  function removeDataCentre(uint datacentreId) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibDataCentre.checkDataCentreIdActive(datacentreId);
    _removeDataCentre(datacentreId);
  }

  /**
    * @dev see { IDataCentre }
    */
  function removeDataCentreByName(string calldata name) external virtual override {
    LibDiamond.enforceIsContractOwner();
    LibDataCentre.DataCentreStorage storage ds = LibDataCentre.dataCentreStorage();
    uint id = ds._dataCentreNameToID[name];
    if (id == 0 || ds._dataCentreMap[id].status != LibCommon.EnumStatus.active) {
        revert InvalidDataCentreName(name);
    }
    _removeDataCentre(id);
  }
  
  /**
    * @dev see { IDataCentre }
    */
  function isRegisteredDataCentreName(string calldata name) external view virtual override returns(bool) {
    return LibDataCentre.dataCentreStorage()._dataCentreNameToID[name] != 0;
  }

  /**
    * @dev see { IDataCentre }
    */
  function getDataCentresById(uint[] calldata ids) external view virtual override returns(LibDataCentre.DataCentre[] memory) {
    LibDataCentre.DataCentreStorage storage ds = LibDataCentre.dataCentreStorage();
    uint maxID = ds._datacentreIdCounter;

    uint count = ids.length;
    LibDataCentre.DataCentre[] memory list = new LibDataCentre.DataCentre[](count);
    for (uint i; i < count;) {
        if (ids[i] < 1 || ids[i] > maxID) {
            revert InvalidDataCentreId(ids[i]);
        }
        list[i] = ds._dataCentreMap[ids[i]];
        unchecked { ++i; }            
    }
    return list;
  }

  /**
    * @dev see { IDataCentre }
    */
  function getDataCentresByName(string[] calldata names) external view virtual override returns(LibDataCentre.DataCentre[] memory) {
    LibDataCentre.DataCentreStorage storage ds = LibDataCentre.dataCentreStorage();
    uint count = names.length;
    uint id;
    LibDataCentre.DataCentre[] memory list = new LibDataCentre.DataCentre[](count);
    for (uint i; i < count;) {
        id = ds._dataCentreNameToID[names[i]];
        if (id == 0) {
            revert InvalidDataCentreName(names[i]);
        }
        list[i] = ds._dataCentreMap[id];
        unchecked { ++i; }
    }
    return list;
  }

  /**
   * @notice Get all data centres for inputed ids
   * @param ids Array of data centre ids
   * @return LibDataCentre.DataCentre[] Array of data centres
   */
  function getAllDataCentres(EnumerableSet.UintSet storage ids) internal view virtual returns(LibDataCentre.DataCentre[] memory) {
    LibDataCentre.DataCentreStorage storage ds = LibDataCentre.dataCentreStorage();
    uint count = ids.length();

    LibDataCentre.DataCentre[] memory list = new LibDataCentre.DataCentre[](count);
    for (uint i; i < count;) {
        list[i] = ds._dataCentreMap[ids.at(i)];
        unchecked { ++i; }
    }
    return list;
  }

  /**
   * @notice Get data centres for inputed ids
   * @param status Statua of data centres to be returned
   * @param ids Array of data centre ids
   * @return LibDataCentre.DataCentre[] Array of data centres
   */
  function filterDataCentres(EnumerableSet.UintSet storage ids, LibCommon.EnumStatus status) internal view virtual returns(LibDataCentre.DataCentre[] memory) {
    LibDataCentre.DataCentreStorage storage ds = LibDataCentre.dataCentreStorage();
    uint count = ids.length();
    uint size;
    for (uint i; i < count;) {
      if(ds._dataCentreMap[ids.at(i)].status == status) {
        unchecked {
          ++size;
        }
      }
      unchecked { ++i; }
    }

    uint index;
    LibDataCentre.DataCentre[] memory list = new LibDataCentre.DataCentre[](size);
    for (uint i; i < count;) {
      if(ds._dataCentreMap[ids.at(i)].status == status) {
        list[index] = ds._dataCentreMap[ids.at(i)];
        unchecked {
          ++index;
        }
      }
      unchecked { ++i; }
    }
    return list;
  }

  /**
    * @dev see { IDataCentre }
    */
  function getDataCentresByCountryCode(string calldata countryCode) external view virtual override returns(LibDataCentre.DataCentre[] memory) {
    LibUtils.validateCountryCode(countryCode);
    
    LibDataCentre.DataCentreStorage storage ds = LibDataCentre.dataCentreStorage();
    return getAllDataCentres(ds._countryDataCentreIds[countryCode]);
  }

  /**
    * @dev see { IDataCentre }
    */
  function getDataCentresByCountryCodeAndStatus(string calldata countryCode, LibCommon.EnumStatus status) external view virtual override returns(LibDataCentre.DataCentre[] memory) {
    LibUtils.validateCountryCode(countryCode);
    
    LibDataCentre.DataCentreStorage storage ds = LibDataCentre.dataCentreStorage();
    return filterDataCentres(ds._countryDataCentreIds[countryCode], status);
  }

  /**
    * @dev see { IDataCentre }
    */
  function getDataCentresByRegionCode(string calldata regionCode) external view virtual override returns(LibDataCentre.DataCentre[] memory) {
    LibUtils.validateRegionCode(regionCode);
    LibDataCentre.DataCentreStorage storage ds = LibDataCentre.dataCentreStorage();

    return getAllDataCentres(ds._regionDataCentreIds[regionCode]);
  }

  /**
    * @dev see { IDataCentre }
    */
  function getDataCentresByRegionCodeAndStatus(string calldata regionCode, LibCommon.EnumStatus status) external view virtual override returns(LibDataCentre.DataCentre[] memory) {
    LibUtils.validateRegionCode(regionCode);
    LibDataCentre.DataCentreStorage storage ds = LibDataCentre.dataCentreStorage();

    return filterDataCentres(ds._regionDataCentreIds[regionCode], status);
  }
}
