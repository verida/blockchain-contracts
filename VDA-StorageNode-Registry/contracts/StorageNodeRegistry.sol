//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

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
    mapping (uint => Datacenter) internal _dataCenterMap;

    /**
     * @notice Mapping of datacenter name to ID.
     */
    mapping (string => uint) internal _dataCenterNameToID;
    /**
     * @notice `datacenterId` list per country code
     */
    mapping (string => EnumerableSetUpgradeable.UintSet) internal _countryDataCenterIds;
    /**
     * @notice `datacenterId` list per region code
     */
    mapping (string => EnumerableSetUpgradeable.UintSet) internal _regionDataCenterIds;

    /**
     * @notice Additional information for `datacenterId`
     * @dev Contains removed status & number of connected storage nodes
     */
    mapping (uint => DatacenterInfo) internal _datacenterInfo;

    /**
     * @notice StorageNode by nodeId
     */
    mapping (uint => StorageNode) internal _nodeMap;

    /**
     * @notice UnregisterTime of each storage node
     * @dev Value is over 0 if unregistered
     */
    mapping (uint => uint) internal _nodeUnregisterTime;

    /**
     * @notice nodeId per did address
     */
    mapping (address => uint) internal _didNodeId;

    /** 
     * @notice nodeId per endpointUri
     */
    mapping (string => uint) internal _endpointNodeId;

    /**
     * @notice nodeId list per country code
     */
    mapping (string => EnumerableSetUpgradeable.UintSet) internal _countryNodeIds;

    /**
     * @notice nodeId list per region code
     */
    mapping (string => EnumerableSetUpgradeable.UintSet) internal _regionNodeIds;

    /**
     * @notice Staked Verida token amount per each DID address
     */
    mapping (address => uint) internal _stakedTokenAmount;


    /**
     * @notice datacenterId counter
     * @dev starts from 1
     */
    CountersUpgradeable.Counter internal _datacenterIdCounter;
    /**
     * @notice nodeId counter
     * @dev starts from 1
     */
    CountersUpgradeable.Counter internal _nodeIdCounter;

    /**
     * @notice Slot information
     */
    SlotInfo internal _slotInfo;

    /**
     * @notice Verida Token contract address
     * @dev Verida Token is required in `addNode()` and `removeNode()` functions
     */
    address public vdaTokenAddress;

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

    /**
     * @notice Additional information related to staking slots
     * @dev Used internally inside the contract
     * @param isStakingRequired true if staking required, otherwise false
     * @param STAKE_PER_SLOT The number of tokens required to stake for one storage slot.
     * @param MIN_SLOTS The minimum value of `STAKE_PER_SLOT`
     * @param MAX_SLOTS The maximum value of `STAKE_PER_SLOT`
     */
    struct SlotInfo {
        bool isStakingRequired;
        uint STAKE_PER_SLOT;
        uint MIN_SLOTS;
        uint MAX_SLOTS;
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
    error InvalidTokenAddress();
    error InvalidNumberSlots();
    error InvalidValue();
    error NoExcessTokenAmount();

    // constructor() {
    //     _disableInitializers();
    // }

    /**
     * @dev initializer of deployment
     */
    function initialize(address tokenAddress) initializer public {
        __VDAVerificationContract_init();

        _slotInfo.STAKE_PER_SLOT = 30;
        _slotInfo.isStakingRequired = false;
        _slotInfo.MIN_SLOTS = 20000;
        _slotInfo.MAX_SLOTS = 20000;

        vdaTokenAddress = tokenAddress;
    }

    /**
     * @notice Check whether the value is lowercase string
     * @param value String value to check
     * @return true if value is lowercase
     */
    function isLowerCase(string calldata value) internal pure returns(bool) {
        bytes memory _baseBytes = bytes(value);
        for (uint i; i < _baseBytes.length;) {
            if (_baseBytes[i] >= 0x41 && _baseBytes[i] <= 0x5A) {
                return false;
            }
            unchecked { ++i; }
        }

        return true;
    }

    /**
     * @notice Check validity of country code
     * @param countryCode Unique two-character string code
     */
    function validateCountryCode(string calldata countryCode) internal pure {
        if (bytes(countryCode).length != 2 || !isLowerCase(countryCode)) {
            revert InvalidCountryCode();
        }
    }

    /**
     * @notice Check validity of region code
     * @param regionCode Unique region string code
     */
    function validateRegionCode(string calldata regionCode) internal pure {
        if (bytes(regionCode).length == 0 || !isLowerCase(regionCode)) {
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
    function addDatacenter(Datacenter calldata data) external payable onlyOwner override
         returns(uint) {
        {
            if (bytes(data.name).length == 0 || !isLowerCase(data.name)) {
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
    function removeDatacenter(uint datacenterId) external payable onlyOwner override {
        {
            checkDatacenterIdExistance(datacenterId);
            
            if (_datacenterInfo[datacenterId].nodeCount != 0) {
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
     * @notice Store node information to the storage and emit the event
     * @dev Internal function used in the `addNode()` function. Created for stack deep error
     * @param nodeInfo Node information to store
     */
    function storeNodeInfo(
        StorageNodeInput memory nodeInfo
        ) internal {
        {
            _nodeIdCounter.increment();
            uint nodeId = _nodeIdCounter.current();

            _nodeMap[nodeId].didAddress = nodeInfo.didAddress;
            _nodeMap[nodeId].endpointUri = nodeInfo.endpointUri;
            _nodeMap[nodeId].countryCode = nodeInfo.countryCode;
            _nodeMap[nodeId].regionCode = nodeInfo.regionCode;
            _nodeMap[nodeId].datacenterId = nodeInfo.datacenterId;
            _nodeMap[nodeId].lat = nodeInfo.lat;
            _nodeMap[nodeId].long = nodeInfo.long;
            _nodeMap[nodeId].numberSlots = nodeInfo.numberSlots;
            _nodeMap[nodeId].establishmentDate = block.timestamp;

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
            nodeInfo.long,
            nodeInfo.numberSlots,
            block.timestamp
            );

    }

    /**
     * @notice Calculate the required token amount for slots
     * @dev Internal function. Used in `stakeToken()` and `getExcessTokenAmount()` functions
     * @param numberSlot Number of slots
     * @return uint Required token amount
     */
    function requiredTokenAmount(uint numberSlot) internal view returns(uint) {
        uint totalAmount = 10 ** ERC20Upgradeable(vdaTokenAddress).decimals();
        totalAmount = _slotInfo.STAKE_PER_SLOT * totalAmount;
        return numberSlot * totalAmount;
    }

    /**
     * @notice Stake required tokens from the requestor of `addNode()` function
     * @dev Internal function. Called inside of `addNode()` function
     * @param didAddress DID address that calls the `addNode()` function
     * @param from EOA wallet that provide necessary Verida token for `addNode()` function
     * @param numberSlot Number of slots being added in the `addNode()` function
     */
    function stakeToken(address didAddress, address from, uint numberSlot) internal {
        uint totalAmount = requiredTokenAmount(numberSlot);

        IERC20Upgradeable tokenContract = IERC20Upgradeable(vdaTokenAddress);

        tokenContract.transferFrom(from, address(this), totalAmount);

        _stakedTokenAmount[didAddress] = totalAmount;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function addNode(
        StorageNodeInput calldata nodeInfo,
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

            // Check whether the numberSlots is zero
            if (nodeInfo.numberSlots < _slotInfo.MIN_SLOTS || nodeInfo.numberSlots > _slotInfo.MAX_SLOTS) {
                revert InvalidNumberSlots();
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
                nodeInfo.long,
                nodeInfo.numberSlots
            );

            verifyRequest(nodeInfo.didAddress, params, requestSignature, requestProof);

            verifyAuthSignature(nodeInfo.didAddress, authSignature);
        }

        if (_slotInfo.isStakingRequired) {
            stakeToken(nodeInfo.didAddress, tx.origin, nodeInfo.numberSlots);
        }

        storeNodeInfo(nodeInfo);
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
        if (nodeId == 0 || _nodeUnregisterTime[nodeId] != 0) {
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
     * @notice Release staked token to the requestor of `removeNodeComplete()` function
     * @dev Internal function. Called inside of `removeNodeComplete()` function
     * @param didAddress DID address that calls the `removeNodeComplete()` function
     * @param to EOA wallet that will received the released token
     */
    function releaseToken(address didAddress, address to) internal {
        uint totalAmount = _stakedTokenAmount[didAddress];

        if (totalAmount > 0) {
            IERC20Upgradeable(vdaTokenAddress).transfer(to, totalAmount);
            _stakedTokenAmount[didAddress] = 0;
        }        
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

        // Release staked token
        releaseToken(didAddress, tx.origin);

        // Clear registered information
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
     * @notice Create tuple for StorageNode with status
     * @param nodeId StorageNode ID created by `addNode()` function
     * @return StorageNode StoargeNode struct
     * @return string Status string
     */
    function getNodeWithStatus(uint nodeId) private view returns(StorageNode memory, string memory) {
        string memory status = "active";
        if (_nodeUnregisterTime[nodeId] != 0) {
            status = "removed";
        }

        return (_nodeMap[nodeId], status);
    }
    
    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getNodeByAddress(address didAddress) external view override returns(StorageNode memory, string memory) {
        uint nodeId = _didNodeId[didAddress];
        if (nodeId == 0) {
            revert InvalidDIDAddress();
        }

        return getNodeWithStatus(nodeId);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getNodeByEndpoint(string calldata endpointUri) external view override returns(StorageNode memory, string memory) {
        uint nodeId = _endpointNodeId[endpointUri];

        if (nodeId == 0) {
            revert InvalidEndpointUri();
        }

        return getNodeWithStatus(nodeId);
    }

    /**
     * @notice Filter active node IDs from set
     * @dev Used for `getNodesByCountry()` and `getNodesByRegion()` functions
     * @param ids ID set
     * @return StorageNode[] Array of active storage nodes
     */
    function filterActiveStorageNodes(EnumerableSetUpgradeable.UintSet storage ids) internal view returns(StorageNode[] memory) {
        uint count = ids.length();
        uint removedCount;

        {
            uint nodeId;
            for (uint i; i < count; ++i) {
                nodeId = ids.at(i);
                if (_nodeUnregisterTime[nodeId] != 0) {
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
        return filterActiveStorageNodes(_countryNodeIds[countryCode]);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getNodesByRegion(string calldata regionCode) external view override returns(StorageNode[] memory) {
        return filterActiveStorageNodes(_regionNodeIds[regionCode]);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function isStakingRequired() external view returns(bool) {
        return _slotInfo.isStakingRequired;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function setStakingRequired(bool isRequired) external onlyOwner override {
        if (isRequired == _slotInfo.isStakingRequired) {
            revert InvalidValue();
        }

        _slotInfo.isStakingRequired = isRequired;
        emit UpdateStakingRequired(isRequired);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getStakePerSlot() external view returns(uint) {
        return _slotInfo.STAKE_PER_SLOT;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function updateStakePerSlot(uint newVal) external onlyOwner override {
        if (newVal == 0 || newVal == _slotInfo.STAKE_PER_SLOT) {
            revert InvalidValue();
        }

        _slotInfo.STAKE_PER_SLOT = newVal;
        emit UpdateStakePerSlot(newVal);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getNumberSlotsRange() external view returns(uint, uint) {
        return (_slotInfo.MIN_SLOTS, _slotInfo.MAX_SLOTS);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function updateMinSlots(uint minSlots) external onlyOwner override {
        if (minSlots == 0 || minSlots == _slotInfo.MIN_SLOTS || minSlots > _slotInfo.MAX_SLOTS) {
            revert InvalidValue();
        }

        _slotInfo.MIN_SLOTS = minSlots;
        emit UpdateMinSlots(minSlots);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function updateMaxSlots(uint maxSlots) external onlyOwner override {
        if (maxSlots == 0 || maxSlots == _slotInfo.MAX_SLOTS || maxSlots < _slotInfo.MIN_SLOTS) {
            revert InvalidValue();
        }

        _slotInfo.MAX_SLOTS = maxSlots;
        emit UpdateMaxSlots(maxSlots);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function updateTokenAddress(address newTokenAddress) external onlyOwner {
        // Check the validity of the token address
        {
            if (vdaTokenAddress == newTokenAddress) {
                revert InvalidTokenAddress();
            }

            assembly {
                if iszero(newTokenAddress) {
                    let ptr := mload(0x40)
                    mstore(ptr, 0x1eb00b0600000000000000000000000000000000000000000000000000000000)
                    revert(ptr, 0x4) //revert InvalidTokenAddress()
                }
            }
        }

        address oldAddress = vdaTokenAddress;
        vdaTokenAddress = newTokenAddress;

        emit UpdateTokenAddress(oldAddress, newTokenAddress);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getBalance(address didAddress) external view returns(uint) {
        return _stakedTokenAmount[didAddress];
    }

    /**
     * @notice Calculate the excess token amount for a DID address
     * @dev Internal function used in `excessTokenAmount()` and `withdraw()` functions
     * @param didAddress DID address
     * @return uint Return 0 if staked amount is less than the required amount
     */
    function getExcessTokenAmount(address didAddress) internal view returns(uint) {
        uint nodeId = _didNodeId[didAddress];
        if (nodeId == 0) {
            revert InvalidDIDAddress();
        }

        uint totalAmount = requiredTokenAmount(_nodeMap[nodeId].numberSlots);

        if (_stakedTokenAmount[didAddress] <= totalAmount) {
            return 0;
        }

        return (_stakedTokenAmount[didAddress] - totalAmount);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function excessTokenAmount(address didAddress) external view returns(uint) {
        return getExcessTokenAmount(didAddress);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function withdrawExcessToken(
        address didAddress, 
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external {
        uint nodeId = _didNodeId[didAddress];
        {
            if (nodeId == 0) {
                revert InvalidDIDAddress();
            }

            bytes memory params = abi.encodePacked(didAddress);
            verifyRequest(didAddress, params, requestSignature, requestProof);
        }

        uint releaseAmount = getExcessTokenAmount(didAddress);

        if (releaseAmount == 0) {
            revert NoExcessTokenAmount();
        }

        IERC20Upgradeable(vdaTokenAddress).transfer(tx.origin, releaseAmount);

        _stakedTokenAmount[didAddress] -= releaseAmount;

        emit TokenWithdrawn(didAddress, tx.origin, releaseAmount);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function depoistToken(address didAddress, uint tokenAmount) external {
        uint nodeId = _didNodeId[didAddress];
        if (nodeId == 0) {
            revert InvalidDIDAddress();
        }

        IERC20Upgradeable(vdaTokenAddress).transferFrom(tx.origin, address(this), tokenAmount);

        _stakedTokenAmount[didAddress] += tokenAmount;

        emit TokenDeposited(didAddress, tx.origin, tokenAmount);
    }
}