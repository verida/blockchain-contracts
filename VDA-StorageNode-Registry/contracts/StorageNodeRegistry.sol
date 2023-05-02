//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "@verida/vda-verification-contract/contracts/VDAVerificationContract.sol";

import "./IStorageNodeRegistry.sol";


/**
 * @title Verida StorageNodeRegistry contract
 */
contract StorageNodeRegistry is IStorageNodeRegistry, VDAVerificationContract {

    using CountersUpgradeable for CountersUpgradeable.Counter;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

    /**
     * @notice Datacenter infos by `datacenterId`
     */
    mapping (uint => Datacenter) private _dataCenterMap;

    /**
     * @notice Mapping of datacenter name to ID.
     */
    mapping (string => uint) private _dataCenterNameToID;
    /**
     * @notice `datacenterId` list per country code
     */
    mapping (string => EnumerableSetUpgradeable.UintSet) private _countryDataCenterIds;
    /**
     * @notice `datacenterId` list per region code
     */
    mapping (string => EnumerableSetUpgradeable.UintSet) private _regionDataCenterIds;

    /**
     * @notice Additional information for `datacenterId`
     * @dev Contains removed status & number of connected storage nodes
     */
    mapping (uint => DatacenterInfo) private _datacenterInfo;


    /**
     * @notice StorageNode by nodeId
     */
    mapping (uint => StorageNode) private _nodeMap;

    /**
     * @notice UnregisterTime of each storage node
     * @dev Value is over 0 if unregistered
     */
    mapping (uint => uint) private _nodeUnregisterTime;

    /**
     * @notice nodeId per did address
     */
    mapping (address => uint) private _didNodeId;

    /** 
     * @notice nodeId per endpointUri
     */
    mapping (string => uint) private _endpointNodeId;

    /**
     * @notice nodeId list per country code
     */
    mapping (string => EnumerableSetUpgradeable.UintSet) private _countryNodeIds;

    /**
     * @notice nodeId list per region code
     */
    mapping (string => EnumerableSetUpgradeable.UintSet) private _regionNodeIds;


    /**
     * @notice datacenterId counter
     * @dev starts from 1
     */
    CountersUpgradeable.Counter private _datacenterIdCounter;
    /**
     * @notice nodeId counter
     * @dev starts from 1
     */
    CountersUpgradeable.Counter private _nodeIdCounter;

    /**
     * @notice Denominator for latitude & longitude values
     */
    uint8 public constant DECIMAL = 8;

    /**
     * @notice Additional information for a data center
     * @dev Used internally inside the contract
     * @param isActive True when added. False after removed
     * @param nodeCount Number of connected storage nodes
     */
    struct DatacenterInfo {
        bool isActive;
        uint nodeCount;
    }

    error InvalidDatacenterName();
    error InvalidCountryCode();
    error InvalidRegionCode();
    error InvalidLatitude();
    error InvalidLongitude();
    error InvalidDatacenterId(uint id);
    error HasDependingNodes();
    error removedDatacenterId();

    error InvalidEndpointUri();
    error InvalidDIDAddress();

    error InvalidUnregisterTime();

    constructor() {
        _disableInitializers();
    }

    /**
     * @dev initializer of deployment
     */
    function initialize() initializer public {
        __VDAVerificationContract_init();
    }

    /**
     * @notice Check validity of countryCode, regionCode, and geo location
     * @param countryCode Unique two-character string code
     * @param regionCode Unique region string code
     * @param lat Latitude
     * @param long Longitude
     */
    function validateInput(
        string calldata countryCode, 
        string calldata regionCode,
        int lat,
        int long ) internal pure {
        if (bytes(countryCode).length != 2) {
            revert InvalidCountryCode();
        }

        if (bytes(regionCode).length == 0) {
            revert InvalidRegionCode();
        }

        if ( lat < -90 * int(10 ** DECIMAL) || lat > 90 * int(10 ** DECIMAL)) {
            revert InvalidLatitude();
        }

        if (long < -180 * int(10 ** DECIMAL) || long > 180 * int(10 ** DECIMAL)) {
            revert InvalidLongitude();
        }
    }

    /**
     * @notice Check validity of datacenterId
     * @dev `datacenterId` should be the one that was added by contract owner
     * @param id datacenterId
     */
    function checkDatacenterId(uint id) internal view {
        if (!_datacenterInfo[id].isActive) {
            revert InvalidDatacenterId(id);
        }
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function addDatacenter(Datacenter calldata data) external override onlyOwner 
         returns(uint) {
        {
            if (bytes(data.name).length == 0) {
                revert InvalidDatacenterName();
            }

            if (_dataCenterNameToID[data.name] != 0) {
                revert InvalidDatacenterName();
            }

            validateInput(data.countryCode, data.regionCode, data.lat, data.long);
        }

        _datacenterIdCounter.increment();
        uint datacenterId = _datacenterIdCounter.current();

        _dataCenterMap[datacenterId] = data;
        _dataCenterNameToID[data.name] = datacenterId;
        
        _datacenterInfo[datacenterId].isActive = true;

        _countryDataCenterIds[data.countryCode].add(datacenterId);
        _regionDataCenterIds[data.regionCode].add(datacenterId);

        emit AddDataCenter(datacenterId, data.name, data.countryCode, data.regionCode, data.lat, data.long);

        return datacenterId;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function removeDatacenter(uint datacenterId) external override onlyOwner {
        {
            checkDatacenterId(datacenterId);

            if (!_datacenterInfo[datacenterId].isActive) {
                revert removedDatacenterId();
            }

            EnumerableSetUpgradeable.UintSet storage connectedNodes = _datacenterInfo[datacenterId].connectedNodeIds;
            bool hasDependencies;
            uint nodeId;
            uint count = connectedNodes.length();


            for (uint i; i < count && hasDependencies == false; ++i) {
                nodeId = connectedNodes.at(i);
                if (_nodeUnregisterTime[nodeId] == 0 || _nodeUnregisterTime[nodeId] < block.timestamp ) {
                    hasDependencies = true;
                }
            }
            if (hasDependencies) {
                revert HasDependingNodes();
            }
        }

        Datacenter storage datacenter = _dataCenterMap[datacenterId];
        
        _countryDataCenterIds[datacenter.countryCode].remove(datacenterId);
        _regionDataCenterIds[datacenter.regionCode].remove(datacenterId);
        delete _dataCenterNameToID[datacenter.name];
        delete _dataCenterMap[datacenterId];
        delete _datacenterInfo[datacenterId];

        emit RemoveDataCenter(datacenterId);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getDatacenters(uint[] calldata ids) external view override returns(Datacenter[] memory) {
        uint count = ids.length;
        Datacenter[] memory list = new Datacenter[](count);

        for (uint i; i < count; ++i) {
            if (!_datacenterInfo[ids[i]].isActive) {
                revert InvalidDatacenterId(ids[i]);
            }

            list[i] = _dataCenterMap[ids[i]];
        }

        return list;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getDataCentersByCountry(string calldata countryCode) external view override returns(Datacenter[] memory) {
        uint count = _countryDataCenterIds[countryCode].length();
        Datacenter[] memory list = new Datacenter[](count);

        EnumerableSetUpgradeable.UintSet storage countryIds = _countryDataCenterIds[countryCode];

        for (uint i; i < count; ++i) {
            list[i] = _dataCenterMap[countryIds.at(i)];
        }

        return list;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getDataCentersByRegion(string calldata regionCode) external view override returns(Datacenter[] memory) {
        uint count = _regionDataCenterIds[regionCode].length();
        Datacenter[] memory list = new Datacenter[](count);

        EnumerableSetUpgradeable.UintSet storage regionIds = _regionDataCenterIds[regionCode];

        for (uint i; i < count; ++i) {
            list[i] = _dataCenterMap[regionIds.at(i)];
        }

        return list;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function addNode(
        StorageNode calldata nodeInfo,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external override {
        {
            validateInput(nodeInfo.countryCode, nodeInfo.regionCode, nodeInfo.lat, nodeInfo.long);

            checkDatacenterId(nodeInfo.datacenterId);

            // Check whether endpointUri is empty
            if (bytes(nodeInfo.endpointUri).length == 0) {
                revert InvalidEndpointUri();
            }

            // Check whether didAddress was registered before
            uint didNodeId = _didNodeId[nodeInfo.didAddress];
            if (didNodeId != 0) {
                // Check whether removed
                if (_nodeUnregisterTime[didNodeId] == 0 || _nodeUnregisterTime[didNodeId] > block.timestamp) {
                    revert InvalidDIDAddress();
                }
            }

            // Check whether endpoint was registered before
            if (_endpointNodeId[nodeInfo.endpointUri] != 0) {
                revert InvalidEndpointUri();
            }
            
            bytes memory params = abi.encodePacked(
                nodeInfo.didAddress,
                nodeInfo.endpointUri,
                nodeInfo.countryCode);

            params = abi.encodePacked(
                params,
                nodeInfo.regionCode,
                nodeInfo.datacenterId);
                
            params = abi.encodePacked(
                params,
                nodeInfo.lat,
                nodeInfo.long
            );

            verifyRequest(nodeInfo.didAddress, params, requestSignature, requestProof);
        }

        {
            _nodeIdCounter.increment();
            uint nodeId = _nodeIdCounter.current();

            _nodeMap[nodeId] = nodeInfo;
            _didNodeId[nodeInfo.didAddress] = nodeId;
            _endpointNodeId[nodeInfo.endpointUri] = nodeId;
            _countryNodeIds[nodeInfo.countryCode].add(nodeId);
            _regionNodeIds[nodeInfo.regionCode].add(nodeId);

            ++_datacenterInfo[nodeInfo.datacenterId].nodeCount;
        }

        emit AddNode(
            nodeInfo.didAddress, 
            nodeInfo.endpointUri, 
            nodeInfo.countryCode, 
            nodeInfo.regionCode, 
            nodeInfo.datacenterId);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function removeNodeStart(
        address didAddress,
        uint unregisterDateTime,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external override {
        uint nodeId = _didNodeId[didAddress];
        {
            // Check whether didAddress was registered before
            if (nodeId == 0 || _nodeUnregisterTime[nodeId] > 0) {
                revert InvalidDIDAddress();
            }

            if (unregisterDateTime >= (block.timestamp + 28 days)) {
                revert InvalidUnregisterTime();
            }

            bytes memory params = abi.encodePacked(didAddress, unregisterDateTime);
            verifyRequest(didAddress, params, requestSignature, requestProof);
        }

        _nodeUnregisterTime[nodeId] = unregisterDateTime;

        emit RemoveNode(didAddress, unregisterDateTime);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getNodeByAddress(address didAddress) external view override returns(StorageNode memory) {
        uint nodeId = _didNodeId[didAddress];

        if (nodeId == 0) {
            revert InvalidDIDAddress();
        }

        if (_nodeUnregisterTime[nodeId] > 0 && block.timestamp >= _nodeUnregisterTime[nodeId]) {
            revert InvalidDIDAddress();
        }

        return _nodeMap[nodeId];
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getNodeByEndpoint(string calldata endpointUri) external view override returns(StorageNode memory) {
        uint nodeId = _endpointNodeId[endpointUri];

        if (nodeId == 0) {
            revert InvalidEndpointUri();
        }

        if (_nodeUnregisterTime[nodeId] > 0 && block.timestamp >= _nodeUnregisterTime[nodeId]) {
            revert InvalidEndpointUri();
        }

        return _nodeMap[nodeId];
    }

    function filtrActiveStorageNodes(EnumerableSetUpgradeable.UintSet storage ids) internal view returns(StorageNode[] memory) {
        uint count = ids.length();
        uint removedCount;

        {
            uint nodeId;
            for (uint i; i < count; ++i) {
                nodeId = ids.at(i);
                if (_nodeUnregisterTime[nodeId] > 0 && block.timestamp >= _nodeUnregisterTime[nodeId]) {
                    ++removedCount;
                }
            }
        }

        StorageNode[] memory nodeList = new StorageNode[](count - removedCount);
        {
            uint nodeId;
            uint index;
            for (uint i; i < count; ++i) {
                nodeId = ids.at(i);
                if (_nodeUnregisterTime[nodeId] == 0 || block.timestamp < _nodeUnregisterTime[nodeId]) {
                    nodeList[index] = _nodeMap[nodeId];
                    ++index;
                }
            }
        }

        return nodeList;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getNodesByCountry(string calldata countryCode) external view override returns(StorageNode[] memory) {
        return filtrActiveStorageNodes(_countryNodeIds[countryCode]);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getNodesByRegion(string calldata regionCode) external view override returns(StorageNode[] memory) {
        return filtrActiveStorageNodes(_regionNodeIds[regionCode]);
    }

}