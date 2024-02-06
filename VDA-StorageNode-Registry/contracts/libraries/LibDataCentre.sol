// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { LibCommon } from "./LibCommon.sol";

error InvalidDataCentreId(uint id);
error InvalidDataCentreName(string name);

library LibDataCentre {

    using EnumerableSet for EnumerableSet.UintSet;

    bytes32 constant DATACENTRE_STORAGE_POSITION = keccak256("vda.storagenode.datacentre.storage");

    /**
     * @notice Struct representing a data centre
     * @param id Data centre id. Assigned automatically inside the contract
     * @param name Data centre name
     * @param countryCode Unique two-character string code
     * @param regionCode Unique region string code
     * @param lat Latitude
     * @param long Longitude
     * @param nodeCount Number of nodes that depends on this data centre
     * @param status Status of this data centre
     */
    struct DataCentre {
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
     * @param _dataCentreMap Data centre infos by `datacentreId`
     * @param _dataCentreNameToID Mapping of datacentre name to ID.
     * @param _countryDataCentreIds `datacentreId` list per country code
     * @param _regionDataCentreIds `datacentreId` list per region code
     * @param _datacentreIdCounter datacentreId counter. Starts from 1
     */
    struct DataCentreStorage {
        mapping (uint => DataCentre) _dataCentreMap;
        mapping (string => uint) _dataCentreNameToID;
        mapping (string => EnumerableSet.UintSet) _countryDataCentreIds;
        mapping (string => EnumerableSet.UintSet) _regionDataCentreIds;
        uint _datacentreIdCounter;
    }

    function dataCentreStorage() internal pure returns (DataCentreStorage storage ds) {
        bytes32 position = DATACENTRE_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /**
     * @notice Check validity of datacentreId
     * @dev `datacentreId` should be the one that was added by contract owner
     * @param id datacentreId
     */
    function checkDataCentreIdActive(uint id) internal view {
        if (dataCentreStorage()._dataCentreMap[id].status != LibCommon.EnumStatus.active) {
            revert InvalidDataCentreId(id);
        }
    }

    /**
     * @notice Increase the node counts of data centre
     * @param dataCentreId Data centre ID
     */
    function increaseDataCentreNodeCount(uint dataCentreId) internal {
        DataCentreStorage storage ds = dataCentreStorage();
        unchecked {
            ++ds._dataCentreMap[dataCentreId].nodeCount;    
        }
        
    }

    /**
     * @notice Increase the node counts of data centre
     * @param dataCentreId Data centre ID
     */
    function decreaseDataCentreNodeCount(uint dataCentreId) internal {
        DataCentreStorage storage ds = dataCentreStorage();
        unchecked {
            --ds._dataCentreMap[dataCentreId].nodeCount;
        }
    }

}
