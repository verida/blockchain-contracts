// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

error InvalidDataCenterId(uint id);
error InvalidDataCenterName(string name);

library LibDataCenter {

    using EnumerableSet for EnumerableSet.UintSet;

    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("vda.storagenode.datacenter.storage");

    /**
     * @notice Struct representing a data center
     * @param id Data center id. Assigned automatically inside the contract
     * @param name Data center name
     * @param countryCode Unique two-character string code
     * @param regionCode Unique region string code
     * @param lat Latitude
     * @param long Longitude
     */
    struct Datacenter {
        uint id;
        string name;
        string countryCode;
        string regionCode;
        int lat;
        int long;
    }

    /**
     * @notice Additional information for a data center
     * @dev Used internally inside the contract
     * @param isActive True when added. False after removed
     * @param nodeCount Number of connected storage nodes
     */
    struct DataCenterInfo {
        bool isActive;
        uint nodeCount;
    }
    
    /**
     * @param _dataCenterMap Datacenter infos by `datacenterId`
     * @param _dataCenterNameToID Mapping of datacenter name to ID.
     * @param _countryDataCenterIds `datacenterId` list per country code
     * @param _regionDataCenterIds `datacenterId` list per region code
     * @param _datacenterInfo Additional information for `datacenterId`. Contains removed status & number of connected storage nodes
     * @param _datacenterIdCounter datacenterId counter. Starts from 1
     */
    struct DiamondStorage {
        mapping (uint => Datacenter) _dataCenterMap;
        mapping (string => uint) _dataCenterNameToID;
        mapping (string => EnumerableSet.UintSet) _countryDataCenterIds;
        mapping (string => EnumerableSet.UintSet) _regionDataCenterIds;
        mapping (uint => DataCenterInfo) _datacenterInfo;
        uint _datacenterIdCounter;
    }

    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /**
     * @notice Check validity of datacenterId
     * @dev `datacenterId` should be the one that was added by contract owner
     * @param id datacenterId
     */
    function checkDataCenterIdExistance(uint id) internal view {
        if (!diamondStorage()._datacenterInfo[id].isActive) {
            revert InvalidDataCenterId(id);
        }
    }

    /**
    * @dev see { IDataCenter }
    */
    function isDataCenterNameRegistered(string calldata name) internal view returns(bool) {
        return diamondStorage()._dataCenterNameToID[name] != 0;
    }

    /**
     * @dev see { IDataCenter }
     */
    function getDataCenters(uint[] calldata ids) internal view returns(Datacenter[] memory) {
        DiamondStorage storage ds = diamondStorage();

        uint count = ids.length;
        Datacenter[] memory list = new Datacenter[](count);
        for (uint i; i < count;) {
            if (!ds._datacenterInfo[ids[i]].isActive) {
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
    function getDataCentersByName(string[] calldata names) internal view returns(Datacenter[] memory) {
        DiamondStorage storage ds = diamondStorage();
        uint count = names.length;
        uint id;
        Datacenter[] memory list = new Datacenter[](count);
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
     * @dev see { IDataCenter }
     */
    function getDataCentersByCountry(string calldata countryCode) internal view returns(Datacenter[] memory) {
        DiamondStorage storage ds = diamondStorage();
        
        uint count = ds._countryDataCenterIds[countryCode].length();
        Datacenter[] memory list = new Datacenter[](count);

        EnumerableSet.UintSet storage countryIds = ds._countryDataCenterIds[countryCode];

        for (uint i; i < count;) {
            list[i] = ds._dataCenterMap[countryIds.at(i)];
            unchecked { ++i; }
        }

        return list;
    }

    /**
     * @dev see { IDataCenter }
     */
    function getDataCentersByRegion(string calldata regionCode) internal view returns(Datacenter[] memory) {
        DiamondStorage storage ds = diamondStorage();

        uint count = ds._regionDataCenterIds[regionCode].length();
        Datacenter[] memory list = new Datacenter[](count);

        EnumerableSet.UintSet storage regionIds = ds._regionDataCenterIds[regionCode];

        for (uint i; i < count;) {
            list[i] = ds._dataCenterMap[regionIds.at(i)];
            unchecked { ++i; }
        }

        return list;
    }

    /**
     * @notice Increase the node counts of data center
     * @param dataCenterId Datacenter ID
     */
    function increaseDataCenterNodeCount(uint dataCenterId) internal {
        DiamondStorage storage ds = diamondStorage();
        unchecked {
            ++ds._datacenterInfo[dataCenterId].nodeCount;    
        }
        
    }

    /**
     * @notice Increase the node counts of data center
     * @param dataCenterId Datacenter ID
     */
    function decreaseDataCenterNodeCount(uint dataCenterId) internal {
        DiamondStorage storage ds = diamondStorage();
        unchecked {
            --ds._datacenterInfo[dataCenterId].nodeCount;
        }
    }

}
