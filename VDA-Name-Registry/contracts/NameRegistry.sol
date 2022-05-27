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
    mapping(address => DIDInfo) private _DIDInfoList;

    /** 
     * @dev DID Info 
     * User can register multiple usernames to a DID.
     * In case, caller of register() function should be identical. If not, 
     * a user can register username to other's DID.
     */
    struct DIDInfo {
        address owner;
        EnumerableSet.Bytes32Set userNameList;
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

    // Function to receive Ether. msg.data must be empty
    // receive() external payable {}

    // // Fallback function is called when msg.data is not empty
    // fallback() external payable {}

    /**
     * @dev register name & DID
     * @param _name user name is 32bytes string. It's a hash value. Duplication not allowed
     * @param _did DID address.
     * @param signature - Signature provided by transaction creator
     */
    function register(bytes32 _name, address _did, bytes calldata signature) external onlyVerifiedSignature(_did, signature){
        require(_did != address(0x0), "Invalid zero address");
        require(_nameToDID[_name] == address(0x0), "Name already registered");
        
        DIDInfo storage didInfo = _DIDInfoList[_did];
        if (didInfo.owner != address(0x0)) {
            // Meaning registered DID
            require(msg.sender == didInfo.owner, "Not a DID owner");
        }

        _nameToDID[_name] = _did;
        didInfo.owner = msg.sender;
        didInfo.userNameList.add(_name);

        emit Register(_name, _did);
    }

    /**
     * @dev unregister name
     * @param _name user name. Must be registered before
     * @param _did DID address.
     * @param signature - Signature provided by transaction creator
     */
    function unregister(bytes32 _name, address _did, bytes calldata signature) external onlyVerifiedSignature(_did, signature) {
        address callerDID = _nameToDID[_name];
        require(callerDID != address(0x0), "Unregistered name");

        DIDInfo storage didInfo = _DIDInfoList[callerDID];
        require(didInfo.owner == msg.sender, "Not a owner");

        delete _nameToDID[_name];
        didInfo.userNameList.remove(_name);

        // Optional
        if (didInfo.userNameList.length() == 0) {
            didInfo.owner = address(0x0);
        }

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

        DIDInfo storage didInfo = _DIDInfoList[callerDID];
        require(didInfo.owner == msg.sender, "Not a owner");

        return callerDID;
    }

    /**
     * @dev Find name of DID
     * @param _did Must be registered before.
     * @return name
     */
    function getUserNameList(address _did) external view returns(bytes32[] memory) {
        DIDInfo storage didInfo = _DIDInfoList[_did];
        require(didInfo.owner == msg.sender, "Not a owner");

        uint256 length = didInfo.userNameList.length();
        require(length > 0, "No registered DID");

        bytes32[] memory userNameList = new bytes32[](length);

        for (uint i = 0; i < length; i++) {
            userNameList[i] = didInfo.userNameList.at(i);
        }

        return userNameList;
    }

}