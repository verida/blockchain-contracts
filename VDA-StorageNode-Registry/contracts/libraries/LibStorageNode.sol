// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import { LibCommon } from "./LibCommon.sol";

// import "hardhat/console.sol";

library LibStorageNode {
    bytes32 constant NODE_STORAGE_POSITION = keccak256("vda.storagenode.node.storage");

    using EnumerableSet for EnumerableSet.UintSet;

    /**
     * @notice Struct representing a storage node
     * @param name Unique name of the storage node
     * @param didAddress DID address that is associated with the storage node
     * @param endpointUri The storage node endpoint
     * @param countryCode Unique two-character string code
     * @param regionCode Unique region string code
     * @param datacenterId Unique datacenter identifier that is created by `addDataCenter()` method.
     * @param lat Latitude
     * @param long Longitude
     * @param slotCount Number of slots indicationg how many storage slots the node will provide
     * @param establishmentDate Node added time in seconds
     * @param acceptFallbackSlots Indicates if this storage node is willing to accept data from nodes that are shutting down
     * @param status Indicates the statua of node
     * @param unregisterTime Indicates the removed time. 0 if not removed
     * @param fallbackNodeAddress (Optional) Only specified when `status=removing`. DID address of the storage node that is assigned to be the fallback storage node
     */
    struct StorageNode {
        string name;
        address didAddress;
        string endpointUri;
        string countryCode;
        string regionCode;
        uint datacenterId;
        int lat;
        int long;
        uint slotCount;
        uint establishmentDate;
        bool acceptFallbackSlots;
        LibCommon.EnumStatus status;
        uint unregisterTime;
        address fallbackNodeAddress;
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
     * @param _isFallbackSet Set by `removeNodeStart()` function. Shows the node is set as fallback node of another
     * @param _nameNodeId nodeId per name
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
     * @param isWithdrawalEnabled true if users are allowed to withdraw their staked tokens, otherwise false
     */
    struct NodeStorage {
        mapping (uint => StorageNode) _nodeMap;
        mapping (address => bool) _isFallbackSet;
        mapping (string => uint) _nameNodeId;
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
        bool isWithdrawalEnabled;

        address vdaTokenAddress;
    }

    /**
     * @notice return the storage node for `StorageNode`
     * @return ds diamond storage for `StorageNode`
     */
    function nodeStorage() internal pure returns (NodeStorage storage ds) {
        bytes32 position = NODE_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /**
     * @notice Add a reason code for logging issue feature
     * @dev Called by `StorageNodeFacet`
     * @param reasonCode Reason code
     * @param description Description of the reason code
     */
    function addReasonCode(uint reasonCode, string memory description) internal {
        NodeStorage storage ds = nodeStorage();

        ds._reasonCodeSet.add(reasonCode);

        LogReasonCode storage codeInfo = ds._reasonCodeInfo[reasonCode];
        codeInfo.active = true;
        codeInfo.description = description;

        unchecked {
            ++ds.activeReasonCodeCount;    
        }
    }

    /**
     * @notice Calculate the required token amount for slots
     * @dev Internal function. Used in `stakeToken()` and `getExcessTokenAmount()` functions
     * @param numberSlot Number of slots
     * @return uint Required token amount
     */
    function requiredTokenAmount(uint numberSlot) internal view returns(uint) {
        return numberSlot * nodeStorage().STAKE_PER_SLOT;
    }
}
