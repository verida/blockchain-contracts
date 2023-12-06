// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { LibCommon } from "./LibCommon.sol";

error InvalidDataCenterId(uint id);
error InvalidDataCenterName(string name);

library LibDataCenter {

    using EnumerableSet for EnumerableSet.UintSet;

    bytes32 constant DATACENTER_STORAGE_POSITION = keccak256("vda.storagenode.datacenter.storage");

    /**
     * @notice Struct representing a data center
     * @param id Data center id. Assigned automatically inside the contract
     * @param name Data center name
     * @param countryCode Unique two-character string code
     * @param regionCode Unique region string code
     * @param lat Latitude
     * @param long Longitude
     * @param nodeCount Number of nodes that depends on this data center
     * @param status Status of this data center
     */
    struct DataCenter {
        uint id;
        string name;
        string countryCode;
        string regionCode;
        int lat;
        int long;
        uint nodeCount;
        LibCommon.EnumStatus status;
    }
    
    /**
     * @param _dataCenterMap Data center infos by `datacenterId`
     * @param _dataCenterNameToID Mapping of datacenter name to ID.
     * @param _countryDataCenterIds `datacenterId` list per country code
     * @param _regionDataCenterIds `datacenterId` list per region code
     * @param _datacenterIdCounter datacenterId counter. Starts from 1
     */
    struct DataCenterStorage {
        mapping (uint => DataCenter) _dataCenterMap;
        mapping (string => uint) _dataCenterNameToID;
        mapping (string => EnumerableSet.UintSet) _countryDataCenterIds;
        mapping (string => EnumerableSet.UintSet) _regionDataCenterIds;
        uint _datacenterIdCounter;
    }

    function dataCenterStorage() internal pure returns (DataCenterStorage storage ds) {
        bytes32 position = DATACENTER_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /**
     * @notice Check validity of datacenterId
     * @dev `datacenterId` should be the one that was added by contract owner
     * @param id datacenterId
     */
    function checkDataCenterIdActive(uint id) internal view {
        if (dataCenterStorage()._dataCenterMap[id].status != LibCommon.EnumStatus.active) {
            revert InvalidDataCenterId(id);
        }
    }

    /**
     * @notice Increase the node counts of data center
     * @param dataCenterId Data center ID
     */
    function increaseDataCenterNodeCount(uint dataCenterId) internal {
        DataCenterStorage storage ds = dataCenterStorage();
        unchecked {
            ++ds._dataCenterMap[dataCenterId].nodeCount;    
        }
        
    }

    /**
     * @notice Increase the node counts of data center
     * @param dataCenterId Data center ID
     */
    function decreaseDataCenterNodeCount(uint dataCenterId) internal {
        DataCenterStorage storage ds = dataCenterStorage();
        unchecked {
            --ds._dataCenterMap[dataCenterId].nodeCount;
        }
    }

}
