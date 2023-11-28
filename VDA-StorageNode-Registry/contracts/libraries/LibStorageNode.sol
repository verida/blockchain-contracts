// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import { LibDataCenter } from "./LibDataCenter.sol";
import { LibUtils } from "./LibUtils.sol";

error InvalidDIDAddress();
error InvalidEndpointUri();
error InvalidUnregisterTime();
error InvalidSlotCount();
error InvalidValue();

error NoExcessTokenAmount();
error TimeNotElapsed(); // `LOG_LIMIT_PER_DAY` logs in 24 hour
error InvalidSameNodeTime();   
error InvalidAmount();
error InvalidReasonCode();

library LibStorageNode {

    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableMap for EnumerableMap.AddressToUintMap;

    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("vda.storagenode.node.storage");

    /**
     * @notice Struct for StorageNodeInput
     * @dev Used in `addNode()` function
     * @param didAddress DID address that is associated with the storage node
     * @param endpointUri The storage node endpoint
     * @param countryCode Unique two-character string code
     * @param regionCode Unique region string code
     * @param datacenterId Unique datacenter identifier that is created by `addDataCenter()` method.
     * @param lat Latitude
     * @param long Longitude
     * @param slotCount Number of slots indicationg how many storage slots the node will provide
     */
    struct StorageNodeInput {
        address didAddress;
        string endpointUri;
        string countryCode;
        string regionCode;
        uint datacenterId;
        int lat;
        int long;
        uint slotCount;
    }

    /**
     * @notice Struct representing a storage node
     * @param didAddress DID address that is associated with the storage node
     * @param endpointUri The storage node endpoint
     * @param countryCode Unique two-character string code
     * @param regionCode Unique region string code
     * @param datacenterId Unique datacenter identifier that is created by `addDataCenter()` method.
     * @param lat Latitude
     * @param long Longitude
     * @param slotCount Number of slots indicationg how many storage slots the node will provide
     * @param establishmentDate Node added time in seconds
     */
    struct StorageNode {
        address didAddress;
        string endpointUri;
        string countryCode;
        string regionCode;
        uint datacenterId;
        int lat;
        int long;
        uint slotCount;
        uint establishmentDate;
    }

    /**
     * @notice Struct for reason code that used in logging node issues
     * @param description Description of reason code
     * @param active Flag whether this reason code is active
     */
    struct LogReasonCode {
        string description;
        bool active;
    }

    /**
     * @notice Output of Reasoncode
     * @dev Return type of `getReasonCodeList()` function
     * @param reasonCode Reason code
     * @param description description of reason code
     */
    struct LogReasonCodeOutput {
        uint reasonCode;
        string description;
    }

    /**
     * @notice Represent a each log information
     * @dev Every DID keeps `LOG_LIMIT_PER_DAY` DIDLogInformations to restrict logs per day
     * @param nodeDID Node DID from `nodeLogIssue()` function
     * @param reasonCode Reason code from `nodeLogIssue()` function
     * @param time Issue logged time
     */
    struct IssueInformation {
        address nodeDID;
        uint reasonCode;
        uint time;
    }

    /**
     * @notice Represent the log list for a DID
     * @dev It keeps last `LOG_LIMIT_PER_DAY` logs recorded by `logNodeIssue()` function
     * @param _issueList Issue information list
     * @param index The earliest issue index in the list
     */
    struct DIDLogInformation {
        IssueInformation[] _issueList;
        uint index;
    }
    
    /**
     * @param _nodeMap StorageNode by nodeId
     * @param _nodeUnregisterTime UnregisterTime of each storage node. Value is over 0 if unregistered
     * @param _didNodeId nodeId per did address
     * @param _endpointNodeId nodeId per endpointUri
     * @param _countryNodeIds nodeId list per country code
     * @param _regionNodeIds nodeId list per region code
     * @param _stakedTokenAmount Staked Verida token amount per each DID address
     * @param _loggedTokenAmount Logged token amount by node & reason code. Mapping of `Node DID => reason code => DID(logger) => Amount, Used to calculate proportion in `slash()` function
     * @param _issueTotalAmount Total VDA token amount deposited by the `logNodeIssue()` function. Mapping of `Node DID => reason code => total amount` Used in `slash()` function
     * @param _didLogs Issue log list per DID
     * @param _reasonCodeSet Set of reason code. This contains the disabled reason code too
     * @param _reasonCodeInfo Mapping of reason code => code information
     * @param activeReasonCodeCount Total count of active reason codes.
     * @param _nodeIdCounter nodeId counter. starts from 1
     * @param STAKE_PER_SLOT The number of tokens required to stake for one storage slot.
     * @param MIN_SLOTS The minimum value of `STAKE_PER_SLOT`
     * @param MAX_SLOTS The maximum value of `STAKE_PER_SLOT`
     * @param NODE_ISSUE_FEE The number of VDA tokens that must be deposited when recording an issue against a storage node. `default=5`
     * @param SAME_NODE_LOG_DURATION Time after which log available for same node
     * @param totalIssueFee Total amount of tokens that are staked by loggins issues
     * @param isStakingRequired true if staking required, otherwise false
     */
    struct DiamondStorage {
        mapping (uint => StorageNode) _nodeMap;
        mapping (uint => uint) _nodeUnregisterTime;
        mapping (address => uint) _didNodeId;
        mapping (string => uint) _endpointNodeId;

        mapping (string => EnumerableSet.UintSet) _countryNodeIds;
        mapping (string => EnumerableSet.UintSet) _regionNodeIds;

        mapping (address => uint) _stakedTokenAmount;
        mapping (address => mapping(uint => EnumerableMap.AddressToUintMap)) _loggedTokenAmount;
        mapping (address => mapping(uint => uint)) _issueTotalAmount;
        mapping (address => DIDLogInformation) _didLogs;

        EnumerableSet.UintSet _reasonCodeSet;
        mapping(uint => LogReasonCode) _reasonCodeInfo;
        uint activeReasonCodeCount;

        uint _nodeIdCounter;

        uint STAKE_PER_SLOT;
        uint MIN_SLOTS;
        uint MAX_SLOTS;

        uint NODE_ISSUE_FEE;
        uint SAME_NODE_LOG_DURATION;
        uint LOG_LIMIT_PER_DAY;

        uint totalIssueFee;

        bool isStakingRequired;

        address vdaTokenAddress;
    }

    /**
     * @notice Emitted when a storage node added
     * @param didAddress DID address that is associated with the storage node
     * @param endpointUri The storage node endpoint
     * @param countryCode Unique two-character string code
     * @param regionCode Unique region string code
     * @param datacenterId Unique datacenter identifier that is created by `addDataCenter()` method.
     * @param slotCount Number of slots indicationg how many storage slots the node will provide
     * @param establishmentDate Node added time in seconds
     */
    event AddNode(
        address indexed didAddress, 
        string indexed endpointUri,
        string countryCode,
        string regionCode,
        uint datacenterId,
        int lat,
        int long,
        uint slotCount,
        uint establishmentDate
    );

    /**
     * @notice Emitted when a removing node is requested
     * @param didAddress DID address that is to be removed from the network
     * @param unregisterDateTime The unix timestamp of when the storage node should no logner be available for selection.
        Must be at leaset 28 dayse in the future from calling function point
     */
    event RemoveNodeStart(address indexed didAddress, uint unregisterDateTime);

    /**
     * @notice Emitted when a removing node is completed
     * @param didAddress DID address that is to be removed from the network
     */
    event RemoveNodeComplete(address indexed didAddress);

    /**
     * @notice Emitted when the `isStakingRequired` value is updated
     * @param newVal New value updated
     */
    event UpdateStakingRequired(bool newVal);

    /**
     * @notice Emitted when the `STAKE_PER_SLOT` value is updated
     * @param newVal New value updated
     */
    event UpdateStakePerSlot(uint newVal);

    /**
     * @notice Emitted when the `MIN_SLOTS` value is updated
     * @param newVal New value updated
     */
    event UpdateMinSlotCount(uint newVal);

    /**
     * @notice Emitted when the `MAX_SLOTS` value is updated
     * @param newVal New value updated
     */
    event UpdateMaxSlotCount(uint newVal);

    /**
     * @notice Emitted when the excess tokens are withdrawn
     * @param didAddress DID address
     * @param to Token receiving address
     * @param amount Withdrawn amount
     */
    event TokenWithdrawn(address indexed didAddress, address to, uint amount);

    /**
     * @notice Emitted when the tokens are deposited
     * @param didAddress DID address
     * @param from Wallet address from which tokens are deposited
     * @param amount Deposited amount
     */
    event TokenDeposited(address indexed didAddress, address from, uint amount);

    /**
     * @notice Emitted when the NODE_ISSUE_FEE updated
     * @param orgFee Original fee value
     * @param newFee Updated fee value
     */
    event UpdateNodeIssueFee(uint orgFee, uint newFee);

    /**
     * @notice Emitted when the SAME_NODE_LOG_DURATION updated
     * @param orgVal Original value
     * @param newVal Updated value
     */
    event UpdateSameNodeLogDuration(uint orgVal, uint newVal);

    /**
     * @notice Emitted when the LOG_LIMIT_PER_DAY updated
     * @param orgVal Original value
     * @param newVal Updated value
     */
    event UpdateLogLimitPerDay(uint orgVal, uint newVal);

    /**
     * @notice Emitted when a reason code is added
     * @param reasonCode Code that is newly added
     * @param description Description of added reason code
     */
    event AddReasonCode(uint indexed reasonCode, string description);

    /**
     * @notice Emitted when a reason code is disabled
     * @param reasonCode Code that is disabled
     */
    event DisableReasonCodde(uint indexed reasonCode);

    /**
     * @notice Emitted when the description of a reason code is updated
     * @param reasonCode Code that is updated
     * @param from Original description
     * @param to Updated description
     */
    event UpdateReasonCodeDescription(uint indexed reasonCode, string from, string to);

    /**
     * @notice Emitted when user logged an node issue by `logNodeIssue()` function
     * @param from DID address that logs this issue
     * @param nodeDID DID address of the node
     * @param reasonCode Reason code
     */
    event LoggedNodeIssue(address indexed from, address nodeDID, uint reasonCode);

    /**
     * @notice Emitted when stakes VDA tokens of `nodeDID` was slashed by contract owner
     * @param nodeDID DID address of the node
     * @param reasonCode Reason code
     * @param Amount Slashed amount. This can be a bit different from the parameter of `slash()` function
     * @param rewardedCount Number of dids who received the rewards
     * @param moreInfoUrl On-chain pointer to where more information can be fournd about this slashing
     */
    event Slash(address indexed nodeDID, uint reasonCode, uint Amount, uint rewardedCount, string moreInfoUrl);

    /**
     * @notice Emitted when the contract owner withdraw tokens staked by logging issues
     * @param to Receiver address
     * @param amount Token amount to be withdrawn
     */
    event WithdrawIssueFee(address indexed to, uint amount);

    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /**
     * @notice Store node information to the storage and emit the event
     * @dev Internal function used in the `addNode()` function. Created for stack deep error
     * @param nodeInfo Node information to store
     */
    function storeNodeInfo(StorageNodeInput memory nodeInfo) internal {
        DiamondStorage storage ds = diamondStorage();
        {
            uint nodeId = ++ds._nodeIdCounter;
            StorageNode storage node = ds._nodeMap[nodeId];

            node.didAddress = nodeInfo.didAddress;
            node.endpointUri = nodeInfo.endpointUri;
            node.countryCode = nodeInfo.countryCode;
            node.regionCode = nodeInfo.regionCode;
            node.datacenterId = nodeInfo.datacenterId;
            node.lat = nodeInfo.lat;
            node.long = nodeInfo.long;
            node.slotCount = nodeInfo.slotCount;
            node.establishmentDate = block.timestamp;

            ds._didNodeId[nodeInfo.didAddress] = nodeId;
            ds._endpointNodeId[nodeInfo.endpointUri] = nodeId;
            ds._countryNodeIds[nodeInfo.countryCode].add(nodeId);
            ds._regionNodeIds[nodeInfo.regionCode].add(nodeId);

            LibDataCenter.increaseDataCenterNodeCount(nodeInfo.datacenterId);
        }

        emit AddNode(
            nodeInfo.didAddress, 
            nodeInfo.endpointUri, 
            nodeInfo.countryCode, 
            nodeInfo.regionCode, 
            nodeInfo.datacenterId,
            nodeInfo.lat,
            nodeInfo.long,
            nodeInfo.slotCount,
            block.timestamp
        );
    }

    function addNode(
        LibStorageNode.StorageNodeInput calldata nodeInfo
    ) internal {
        DiamondStorage storage ds = diamondStorage();
        {
            // Check whether endpointUri is empty
            if (bytes(nodeInfo.endpointUri).length == 0) {
                revert InvalidEndpointUri();
            }

            LibUtils.validateCountryCode(nodeInfo.countryCode);
            LibUtils.validateRegionCode(nodeInfo.regionCode);
            LibDataCenter.checkDataCenterIdExistance(nodeInfo.datacenterId);
            LibUtils.validateGeoPosition(nodeInfo.lat, nodeInfo.long);

            // Check whether didAddress was registered before
            if (ds._didNodeId[nodeInfo.didAddress] != 0) {
                revert InvalidDIDAddress();
            }

            // Check whether endpoint was registered before
            if (ds._endpointNodeId[nodeInfo.endpointUri] != 0) {
                revert InvalidEndpointUri();
            }

            // Check whether the slotCount is zero
            if (nodeInfo.slotCount < ds.MIN_SLOTS || nodeInfo.slotCount > ds.MAX_SLOTS) {
                revert InvalidSlotCount();
            }
        }

        if (ds.isStakingRequired) {
            uint totalAmount = requiredTokenAmount(nodeInfo.slotCount);
            IERC20(ds.vdaTokenAddress).transferFrom(tx.origin, address(this), totalAmount);

            ds._stakedTokenAmount[nodeInfo.didAddress] = ds._stakedTokenAmount[nodeInfo.didAddress] + totalAmount;
        }

        storeNodeInfo(nodeInfo);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function removeNodeStart(
        address didAddress,
        uint unregisterDateTime
    ) internal {
        DiamondStorage storage ds = LibStorageNode.diamondStorage();
        uint nodeId = ds._didNodeId[didAddress];

        // Check whether didAddress was registered before
        if (nodeId == 0 || ds._nodeUnregisterTime[nodeId] != 0) {
            revert InvalidDIDAddress();
        }

        if (unregisterDateTime < (block.timestamp + 28 days)) {
            revert InvalidUnregisterTime();
        }

        ds._nodeUnregisterTime[nodeId] = unregisterDateTime;
        emit RemoveNodeStart(didAddress, unregisterDateTime);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function removeNodeComplete(
        address didAddress
    ) internal {
        DiamondStorage storage ds = diamondStorage();

        uint nodeId = ds._didNodeId[didAddress];
        {
            if (nodeId == 0) {
                revert InvalidDIDAddress();
            }

            if (ds._nodeUnregisterTime[nodeId] == 0 || ds._nodeUnregisterTime[nodeId] > block.timestamp) {
                revert InvalidUnregisterTime();
            }
        }

        // Release staked token
        uint totalAmount = ds._stakedTokenAmount[didAddress];
        if (totalAmount != 0) {
            IERC20(ds.vdaTokenAddress).transfer(tx.origin, totalAmount);
            ds._stakedTokenAmount[didAddress] = 0;
        }        

        // Clear registered information
        StorageNode storage nodeInfo = ds._nodeMap[nodeId];

        LibDataCenter.decreaseDataCenterNodeCount(nodeInfo.datacenterId);

        ds._countryNodeIds[nodeInfo.countryCode].remove(nodeId);
        ds._regionNodeIds[nodeInfo.regionCode].remove(nodeId);
        delete ds._endpointNodeId[nodeInfo.endpointUri];
        delete ds._didNodeId[didAddress];
        delete ds._nodeMap[nodeId];

        delete ds._nodeUnregisterTime[nodeId];

        emit RemoveNodeComplete(didAddress);
    }

    /**
     * @notice Calculate the required token amount for slots
     * @dev Internal function. Used in `stakeToken()` and `getExcessTokenAmount()` functions
     * @param numberSlot Number of slots
     * @return uint Required token amount
     */
    function requiredTokenAmount(uint numberSlot) internal view returns(uint) {
        DiamondStorage storage ds = diamondStorage();
        return numberSlot * ds.STAKE_PER_SLOT;
    }

    /**
     * @notice Create tuple for StorageNode with status
     * @param nodeId StorageNode ID created by `addNode()` function
     * @return StorageNode StoargeNode struct
     * @return string Status string
     */
    function getNodeWithStatus(uint nodeId) internal view returns(StorageNode memory, string memory) {
        string memory status = "active";
        DiamondStorage storage ds = diamondStorage();
        if (ds._nodeUnregisterTime[nodeId] != 0) {
            status = "removed";
        }

        return (ds._nodeMap[nodeId], status);
    }
    
    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getNodeByAddress(address didAddress) internal view returns(StorageNode memory, string memory) {
        uint nodeId = diamondStorage()._didNodeId[didAddress];
        if (nodeId == 0) {
            revert InvalidDIDAddress();
        }

        return getNodeWithStatus(nodeId);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getNodeByEndpoint(string calldata endpointUri) internal view returns(StorageNode memory, string memory) {
        uint nodeId = diamondStorage()._endpointNodeId[endpointUri];

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
    function filterActiveStorageNodes(EnumerableSet.UintSet storage ids) internal view  returns(StorageNode[] memory) {
        DiamondStorage storage ds = diamondStorage();

        uint count = ids.length();
        uint removedCount;

        {
            uint nodeId;
            for (uint i; i < count;) {
                nodeId = ids.at(i);
                if (ds._nodeUnregisterTime[nodeId] != 0) {
                    ++removedCount;
                }
                unchecked { ++i; }
            }
        }

        StorageNode[] memory nodeList = new StorageNode[](count - removedCount);
        {
            uint nodeId;
            uint index;
            for (uint i; i < count;) {
                nodeId = ids.at(i);
                if (ds._nodeUnregisterTime[nodeId] == 0) {
                    nodeList[index] = ds._nodeMap[nodeId];
                    ++index;
                }
                unchecked { ++i; }
            }
        }

        return nodeList;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getNodesByCountry(string calldata countryCode) internal view returns(StorageNode[] memory) {
        return filterActiveStorageNodes(diamondStorage()._countryNodeIds[countryCode]);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getNodesByRegion(string calldata regionCode) internal view returns(StorageNode[] memory) {
        return filterActiveStorageNodes(diamondStorage()._regionNodeIds[regionCode]);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function isStakingRequired() internal view returns(bool) {
        return diamondStorage().isStakingRequired;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function setStakingRequired(bool isRequired) internal {
        DiamondStorage storage ds = diamondStorage();
        if (isRequired == ds.isStakingRequired) {
            revert InvalidValue();
        }

        ds.isStakingRequired = isRequired;
        emit UpdateStakingRequired(isRequired);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getStakePerSlot() internal view returns(uint) {
        return diamondStorage().STAKE_PER_SLOT;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function updateStakePerSlot(uint newVal) internal {
        DiamondStorage storage ds = diamondStorage();
        if (newVal == 0 || newVal == ds.STAKE_PER_SLOT) {
            revert InvalidValue();
        }

        ds.STAKE_PER_SLOT = newVal;
        emit UpdateStakePerSlot(newVal);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getSlotCountRange() internal view returns(uint, uint) {
        DiamondStorage storage ds = diamondStorage();
        return (ds.MIN_SLOTS, ds.MAX_SLOTS);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function updateMinSlotCount(uint minSlots) internal {
        DiamondStorage storage ds = diamondStorage();
        if (minSlots == 0 || minSlots == ds.MIN_SLOTS || minSlots > ds.MAX_SLOTS) {
            revert InvalidValue();
        }

        ds.MIN_SLOTS = minSlots;
        emit UpdateMinSlotCount(minSlots);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function updateMaxSlotCount(uint maxSlots) internal {
        DiamondStorage storage ds = diamondStorage();
        if (maxSlots == 0 || maxSlots == ds.MAX_SLOTS || maxSlots < ds.MIN_SLOTS) {
            revert InvalidValue();
        }

        ds.MAX_SLOTS = maxSlots;
        emit UpdateMaxSlotCount(maxSlots);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getBalance(address didAddress) internal view returns(uint) {
        return diamondStorage()._stakedTokenAmount[didAddress];
    }

    /**
     * @notice Calculate the excess token amount for a DID address
     * @dev Internal function used in `excessTokenAmount()` and `withdraw()` functions
     * @param didAddress DID address
     * @return uint Return 0 if staked amount is less than the required amount
     */
    function getExcessTokenAmount(address didAddress) internal view returns(int) {
        DiamondStorage storage ds = diamondStorage();
        uint totalAmount;
        uint nodeId = ds._didNodeId[didAddress];
        if (nodeId != 0 && ds.isStakingRequired) {
            totalAmount = requiredTokenAmount(ds._nodeMap[nodeId].slotCount);    
        }
        
        return (int(ds._stakedTokenAmount[didAddress]) - int(totalAmount));
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function withdraw(
        address didAddress,
        uint amount
    ) internal {
        DiamondStorage storage ds = diamondStorage();

        int excessAmount = getExcessTokenAmount(didAddress);

        if (excessAmount <= 0) {
            revert NoExcessTokenAmount();
        }

        if (amount > uint(excessAmount)) {
            revert InvalidAmount();
        }

        IERC20(ds.vdaTokenAddress).transfer(tx.origin, amount);

        ds._stakedTokenAmount[didAddress] = ds._stakedTokenAmount[didAddress] - amount;

        emit TokenWithdrawn(didAddress, tx.origin, amount);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function depositToken(address didAddress, uint tokenAmount) internal {
        DiamondStorage storage ds = diamondStorage();
        uint nodeId = ds._didNodeId[didAddress];
        if (nodeId == 0) {
            revert InvalidDIDAddress();
        }

        IERC20(ds.vdaTokenAddress).transferFrom(tx.origin, address(this), tokenAmount);

        ds._stakedTokenAmount[didAddress] = ds._stakedTokenAmount[didAddress] + tokenAmount;

        emit TokenDeposited(didAddress, tx.origin, tokenAmount);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getNodeIssueFee() internal view returns(uint){
        return diamondStorage().NODE_ISSUE_FEE;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function updateNodeIssueFee(uint value) internal {
        DiamondStorage storage ds = diamondStorage();

        if (value == 0 || value == ds.NODE_ISSUE_FEE) {
            revert InvalidValue();
        }
        uint orgFee = ds.NODE_ISSUE_FEE;
        ds.NODE_ISSUE_FEE = value;

        emit UpdateNodeIssueFee(orgFee, value);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getTotalIssueFee() internal view returns(uint) {
        return diamondStorage().totalIssueFee;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function withdrawIssueFee(address to, uint amount) internal {
        DiamondStorage storage ds = diamondStorage();
        if (amount > ds.totalIssueFee) {
            revert InvalidValue();
        }
        IERC20(ds.vdaTokenAddress).transfer(to, amount);

        ds.totalIssueFee = ds.totalIssueFee - amount;

        emit WithdrawIssueFee(to, amount);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getSameNodeLogDuration() internal view returns(uint) {
        return diamondStorage().SAME_NODE_LOG_DURATION;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function updateSameNodeLogDuration(uint value) internal {
        DiamondStorage storage ds = diamondStorage();
        if (value == 0 || value == ds.SAME_NODE_LOG_DURATION) {
            revert InvalidValue();
        }
        uint orgVal = ds.SAME_NODE_LOG_DURATION;
        ds.SAME_NODE_LOG_DURATION = value;

        emit UpdateSameNodeLogDuration(orgVal, value);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getLogLimitPerDay() internal view returns(uint) {
        return diamondStorage().LOG_LIMIT_PER_DAY;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function updateLogLimitPerDay(uint value) internal {
        DiamondStorage storage ds = diamondStorage();
        if (value == 0 || value == ds.LOG_LIMIT_PER_DAY) {
            revert InvalidValue();
        }
        uint orgVal = ds.LOG_LIMIT_PER_DAY;
        ds.LOG_LIMIT_PER_DAY = value;

        emit UpdateLogLimitPerDay(orgVal, value);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function addReasonCode(uint reasonCode, string calldata description) internal {
        DiamondStorage storage ds = diamondStorage();
        if (ds._reasonCodeSet.contains(reasonCode)) {
            revert InvalidReasonCode();
        }

        LogReasonCode storage codeInfo = ds._reasonCodeInfo[reasonCode];
        codeInfo.active = true;
        codeInfo.description = description;

        unchecked {
            ++ds.activeReasonCodeCount;    
        }

        emit AddReasonCode(reasonCode, description);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function disableReasonCode(uint reasonCode) internal {
        DiamondStorage storage ds = diamondStorage();
        LogReasonCode storage codeInfo = ds._reasonCodeInfo[reasonCode];
        if (codeInfo.active == false) {
            revert InvalidReasonCode();
        }

        codeInfo.active = false;

        unchecked {
            --ds.activeReasonCodeCount;    
        }
        
        emit DisableReasonCodde(reasonCode);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function updateReasonCodeDescription(uint reasonCode, string calldata description) internal {
        LogReasonCode storage codeInfo = diamondStorage()._reasonCodeInfo[reasonCode];
        if (codeInfo.active == false) {
            revert InvalidReasonCode();
        }

        string memory orgDesc = codeInfo.description;
        codeInfo.description = description;

        emit UpdateReasonCodeDescription(reasonCode, orgDesc, description);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getReasonCodeDescription(uint reasonCode) internal view returns(string memory) {
        DiamondStorage storage ds = diamondStorage();
        if (ds._reasonCodeSet.contains(reasonCode)) {
            revert InvalidReasonCode();
        }

        return ds._reasonCodeInfo[reasonCode].description;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function getReasonCodeList() internal view returns(LogReasonCodeOutput[] memory) {
        DiamondStorage storage ds = diamondStorage();

        uint length = ds.activeReasonCodeCount;
        LogReasonCodeOutput[] memory outList = new LogReasonCodeOutput[](length);
        uint codeCount = ds._reasonCodeSet.length();

        uint index;
        for (uint i; i < codeCount;) {
            uint code = ds._reasonCodeSet.at(i);
            if (ds._reasonCodeInfo[code].active) {
                outList[index].reasonCode = code;
                outList[index].description = ds._reasonCodeInfo[code].description;
                unchecked {
                    ++index;
                }
            }
            unchecked {
                ++i;
            }
        }

        return outList;
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function logNodeIssue(
        address didAddress,
        address nodeAddress,
        uint reasonCode
    ) internal {
        DiamondStorage storage ds = diamondStorage();
        {
            // Check whether nodeDID is registered
            uint nodeId = ds._didNodeId[nodeAddress];
            if (nodeId == 0) {
                revert InvalidDIDAddress();
            }

            // Check whether did equals to node address
            if (didAddress == nodeAddress) {
                revert InvalidDIDAddress();
            }

            // Check reascon code validity
            if (!ds._reasonCodeInfo[reasonCode].active) {
                revert InvalidReasonCode();
            }
        }
        
        DIDLogInformation storage logs = ds._didLogs[didAddress];
        // Check log limit per day
        if (logs._issueList.length >= ds.LOG_LIMIT_PER_DAY) {
            uint earlistTime = logs._issueList[logs.index].time;
            if (block.timestamp - earlistTime < 24 hours) {
                revert TimeNotElapsed();
            }
        }
        // Check 1 hour condition for same node
        for (uint i; i < logs._issueList.length;) {
            if (logs._issueList[i].nodeDID == nodeAddress && 
                (block.timestamp - logs._issueList[i].time) < ds.SAME_NODE_LOG_DURATION) {
                revert InvalidSameNodeTime();
            }
            unchecked { ++i; }
        }

        // Add or update
        if (logs._issueList.length < ds.LOG_LIMIT_PER_DAY) {
            logs._issueList.push(IssueInformation(nodeAddress, reasonCode, block.timestamp));
        } else {
            uint index = logs.index;
            logs._issueList[index].nodeDID = nodeAddress;
            logs._issueList[index].reasonCode = reasonCode;
            logs._issueList[index].time = block.timestamp;
            ++index;
            logs.index = index % ds.LOG_LIMIT_PER_DAY;
        }

        // Transfer fees to this contract
        IERC20(ds.vdaTokenAddress).transferFrom(tx.origin, address(this), ds.NODE_ISSUE_FEE);

        ds.totalIssueFee = ds.totalIssueFee + ds.NODE_ISSUE_FEE;

        uint val;
        EnumerableMap.AddressToUintMap storage didReasonLogAmount = ds._loggedTokenAmount[nodeAddress][reasonCode];
        if (didReasonLogAmount.contains(didAddress)) {
            val = didReasonLogAmount.get(didAddress);
        }

        didReasonLogAmount.set(didAddress, val + ds.NODE_ISSUE_FEE);
        ds._issueTotalAmount[nodeAddress][reasonCode] = ds._issueTotalAmount[nodeAddress][reasonCode] + ds.NODE_ISSUE_FEE;

        emit LoggedNodeIssue(didAddress, nodeAddress, reasonCode);
    }

    /**
     * @dev see { IStorageNodeRegistry }
     */
    function slash(
        address nodeDID,
        uint reasonCode,
        uint amount,
        string calldata moreInfoUrl
    ) internal {
        DiamondStorage storage ds = diamondStorage();

        if (amount == 0 || amount > ds._stakedTokenAmount[nodeDID]) {
            revert InvalidAmount();
        }

        uint issueAmount = ds._issueTotalAmount[nodeDID][reasonCode];
        if (issueAmount == 0) {
            revert InvalidReasonCode();
        }

        EnumerableMap.AddressToUintMap storage logInfo = ds._loggedTokenAmount[nodeDID][reasonCode];
        uint loggerCount = logInfo.length();
        uint distributeTotalAmount;

        for (uint i; i < loggerCount;) {
            (address didAddress, uint loggerStaked) = logInfo.at(i);
            uint distAmount = amount * loggerStaked / issueAmount;
            distributeTotalAmount += distAmount;

            ds._stakedTokenAmount[didAddress] = ds._stakedTokenAmount[didAddress] + distAmount;

            unchecked { ++i; }
        }

        ds._stakedTokenAmount[nodeDID] = ds._stakedTokenAmount[nodeDID] - distributeTotalAmount;

        emit Slash(nodeDID, reasonCode, distributeTotalAmount, loggerCount, moreInfoUrl);
    }
}
