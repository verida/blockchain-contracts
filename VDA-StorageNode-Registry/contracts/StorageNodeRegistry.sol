//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "@verida/vda-verification-contract/contracts/VDAVerificationContract.sol";

import "./IStorageNodeRegistry.sol";

import "hardhat/console.sol";


/**
 * @title Verida StorageNodeRegistry contract
 */
contract StorageNodeRegistry is IStorageNodeRegistry, VDAVerificationContract {

    using CountersUpgradeable for CountersUpgradeable.Counter;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

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
     * @notice Role value for `addNode()` function
     */
    bytes32 internal constant ROLE_NODE_PROVIDER = keccak256("NodeProvider");

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
    error InvalidEndpointUri();
    error InvalidDIDAddress();
    error InvalidUnregisterTime();

    // constructor() {
    //     _disableInitializers();
    // }

    /**
     * @dev initializer of deployment
     */
    function initialize() initializer public {
        __VDAVerificationContract_init();
    }

    /**
     * @notice Check validity of country code
     * @param countryCode Unique two-character string code
     */
    function validateCountryCode(string calldata countryCode) internal pure {
        if (bytes(countryCode).length != 2) {
            revert InvalidCountryCode();
        }
    }

    /**
     * @notice Check validity of region code
     * @param regionCode Unique region string code
     */
    function validateRegionCode(string calldata regionCode) internal pure {
        if (bytes(regionCode).length == 0) {
            revert InvalidRegionCode();
        }
    }

    /**
     * @notice Check validity of latitude and longitude values
     * @param lat Latitude
     * @param long Longitude
     */
    function validateGeoPosition(int lat, int long) internal pure {
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
    function checkDatacenterIdExistance(uint id) internal view {
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

            validateCountryCode(data.countryCode);
            validateRegionCode(data.regionCode);
            validateGeoPosition(data.lat, data.long);
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
            checkDatacenterIdExistance(datacenterId);
            
            if (_datacenterInfo[datacenterId].nodeCount > 0) {
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
        validateCountryCode(countryCode);
        
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
        validateRegionCode(regionCode);
        
        uint count = _regionDataCenterIds[regionCode].length();
        Datacenter[] memory list = new Datacenter[](count);

        EnumerableSetUpgradeable.UintSet storage regionIds = _regionDataCenterIds[regionCode];

        for (uint i; i < count; ++i) {
            list[i] = _dataCenterMap[regionIds.at(i)];
        }

        return list;
    }

    /**
     * @notice Check the `authSignature` parameter of `addNode()` function
     * @param didAddress DID address that is associated with the storage node
     * @param authSignature Signature signed by a trusted signer
     */
    function verifyAuthSignature(address didAddress, bytes calldata authSignature) internal view {
        EnumerableSetUpgradeable.AddressSet storage signers = _trustedSigners;

        if (signers.length() == 0) {
            revert NoSigners();
        }

        if (authSignature.length == 0) {
            revert InvalidSignature();
        }

        bytes memory rawMsg = abi.encodePacked(didAddress);
        bytes32 msgHash = keccak256(rawMsg);

        address authSigner = ECDSAUpgradeable.recover(msgHash, authSignature);

        bool isVerified;
        uint index;
        
        while (index < signers.length() && !isVerified) {
            address account = signers.at(index);

            if (authSigner == account) {
                isVerified = true;
                break;
            }

            unchecked { ++index; }
        }

        if (!isVerified) {
            revert InvalidSignature();
        }   
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function addNode(
        StorageNode calldata nodeInfo,
        bytes calldata requestSignature,
        bytes calldata requestProof,
        bytes calldata authSignature
    ) external override {
        {
            // Check whether endpointUri is empty
            if (bytes(nodeInfo.endpointUri).length == 0) {
                revert InvalidEndpointUri();
            }

            validateCountryCode(nodeInfo.countryCode);
            validateRegionCode(nodeInfo.regionCode);
            checkDatacenterIdExistance(nodeInfo.datacenterId);
            validateGeoPosition(nodeInfo.lat, nodeInfo.long);

            
            // Check whether didAddress was registered before
            if (_didNodeId[nodeInfo.didAddress] != 0) {
                revert InvalidDIDAddress();
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

            verifyAuthSignature(nodeInfo.didAddress, authSignature);
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
            nodeInfo.datacenterId,
            nodeInfo.lat,
            nodeInfo.long);
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

        // Check whether didAddress was registered before
        if (nodeId == 0 || _nodeUnregisterTime[nodeId] > 0) {
            revert InvalidDIDAddress();
        }

        if (unregisterDateTime < (block.timestamp + 28 days)) {
            revert InvalidUnregisterTime();
        }

        bytes memory params = abi.encodePacked(didAddress, unregisterDateTime);
        verifyRequest(didAddress, params, requestSignature, requestProof);

        _nodeUnregisterTime[nodeId] = unregisterDateTime;

        emit RemoveNodeStart(didAddress, unregisterDateTime);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function removeNodeComplete(
        address didAddress,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external override {
        uint nodeId = _didNodeId[didAddress];
        {
            if (nodeId == 0) {
                revert InvalidDIDAddress();
            }

            if (_nodeUnregisterTime[nodeId] == 0 || _nodeUnregisterTime[nodeId] > block.timestamp) {
                revert InvalidUnregisterTime();
            }

            bytes memory params = abi.encodePacked(didAddress);
            verifyRequest(didAddress, params, requestSignature, requestProof);
        }

        StorageNode storage nodeInfo = _nodeMap[nodeId];

        --_datacenterInfo[nodeInfo.datacenterId].nodeCount;

        _countryNodeIds[nodeInfo.countryCode].remove(nodeId);
        _regionNodeIds[nodeInfo.regionCode].remove(nodeId);
        delete _endpointNodeId[nodeInfo.endpointUri];
        delete _didNodeId[didAddress];
        delete _nodeMap[nodeId];

        delete _nodeUnregisterTime[nodeId];

        emit RemoveNodeComplete(didAddress);
    }


    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getNodeByAddress(address didAddress) external view override returns(StorageNode memory) {
        uint nodeId = _didNodeId[didAddress];

        if (nodeId == 0) {
            revert InvalidDIDAddress();
        }

        if (_nodeUnregisterTime[nodeId] > 0) {
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

        if (_nodeUnregisterTime[nodeId] > 0) {
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
                if (_nodeUnregisterTime[nodeId] > 0) {
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
                if (_nodeUnregisterTime[nodeId] == 0) {
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