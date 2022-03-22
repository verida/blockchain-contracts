//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract NameRegistry {

    using EnumerableSet for EnumerableSet.Bytes32Set;
    /**
     * note username to did
     */
    mapping(bytes32 => address) private _nameToDID;

    /** 
     * note DID to username list
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
     */
    function register(bytes32 _name, address _did) public {
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
     */
    function unregister(bytes32 _name) public {
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