//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./BytesLib.sol";
/**
 * @title Verida NameRegistry contract
 */
contract NameRegistry {

    using EnumerableSet for EnumerableSet.Bytes32Set;
    using BytesLib for bytes;

    /**
     * @notice username to did
     */
    mapping(bytes32 => address) private _nameToDID;

    /** 
     * @notice DID to username list
     */
    mapping(address => EnumerableSet.Bytes32Set) private _DIDInfoList;

    /**
     * @notice Modifier to verify validity of transactions
     * @dev Not working on View functions. Cancel transaction if transaction is not verified
     * @param identity - DID of Verida
     * @param signature - Signature provided by transaction creator
     */
    modifier onlyVerifiedSignature(address identity, bytes calldata signature) {
        // require signature is signed by identity
        bytes memory rightSign = hex"67de2d20880a7d27b71cdcb38817ba95800ca82dff557cedd91b96aacb9062e80b9e0b8cb9614fd61ce364502349e9079c26abaa21890d7bc2f1f6c8ff77f6261c";
        require(signature.equal(rightSign), "Invalid signature");
        _;
    }

    /**
     * @notice Modifier to verify validity of transactions
     * @dev Not working on View functions. Cancel transaction if transaction is not verified
     * @param identity - DID of Verida
     * @param signature - Signature provided by transaction creator
     */
    modifier onlyVerifiedSignature(address idntity, bytes calldata signature) {
        // require signature is signed by identity
        bytes memory rightSign = hex"67de2d20880a7d27b71cdcb38817ba95800ca82dff557cedd91b96aacb9062e80b9e0b8cb9614fd61ce364502349e9079c26abaa21890d7bc2f1f6c8ff77f6261c";
        require(signature.equal(rightSign), "bad_actor");
        _;
    }

    event Register(bytes32 indexed name, address indexed DID);
    event Unregister(bytes32 indexed name, address indexed DID);

    /**
     * @dev register name & DID
     * @param _name user name is 32bytes string. It's a hash value. Duplication not allowed
     * @param _did DID address.
     * @param signature - Signature provided by transaction creator
     */
    function register(bytes32 _name, address _did, bytes calldata signature) external onlyVerifiedSignature(_did, signature){
        require(_did != address(0x0), "Invalid zero address");
        require(_nameToDID[_name] == address(0x0), "Name already registered");
        
        EnumerableSet.Bytes32Set storage didUserNameList = _DIDInfoList[_did];
        
        _nameToDID[_name] = _did;
        didUserNameList.add(_name);

        emit Register(_name, _did);
    }

    /**
     * @dev unregister name
     * @param _name user name. Must be registered before
     * @param _did DID address.
     * @param signature - Signature provided by transaction creator
     */
    function unregister(bytes32 _name, address _did, bytes calldata signature) external onlyVerifiedSignature(_did, signature) {
        require(_did != address(0x0), "Invalid zero address");

        address callerDID = _nameToDID[_name];
        require(callerDID != address(0x0), "Unregistered name");

        require(callerDID == _did, "Invalid DID");

        EnumerableSet.Bytes32Set storage didUserNameList = _DIDInfoList[callerDID];

        delete _nameToDID[_name];
        didUserNameList.remove(_name);

        emit Unregister(_name, callerDID);
    }

    /**
     * @dev Find did for name
     * @param _name user name. Must be registered
     * @return DID address of user
     */
    function findDid(bytes32 _name) external view returns(address) {
        address callerDID = _nameToDID[_name];
        require(callerDID != address(0x0), "Unregistered name");

        return callerDID;
    }

    /**
     * @dev Find name of DID
     * @param _did Must be registered before.
     * @param signature - Signature provided by transaction creator
     * @return name
     */
    function getUserNameList(address _did, bytes calldata signature) external view onlyVerifiedSignature(_did, signature) returns(bytes32[] memory) {
        EnumerableSet.Bytes32Set storage didUserNameList = _DIDInfoList[_did];

        uint256 length = didUserNameList.length();
        require(length > 0, "No registered DID");

        bytes32[] memory userNameList = new bytes32[](length);

        for (uint i = 0; i < length; i++) {
            userNameList[i] = didUserNameList.at(i);
        }

        return userNameList;
    }

}