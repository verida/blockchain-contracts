//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./BytesLib.sol";
/**
 * @title Verida NameRegistry contract
 */
contract NameRegistry is Ownable{

    using EnumerableSet for EnumerableSet.Bytes32Set;
    using BytesLib for bytes;

    /**
     * @notice username to did
     */
    mapping(bytes32 => address) private _nameToDID;

    /**
     * @notice Allowed suffix list
     */
    EnumerableSet.Bytes32Set private suffixList;

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

    modifier onlyValidSuffix(bytes32 name) {
        bytes32 suffix = getSuffix(name);
        require(suffixList.contains(suffix), "Unregistered suffix");
        _;
    }

    event Register(bytes32 indexed name, address indexed DID);
    event Unregister(bytes32 indexed name, address indexed DID);

    constructor() {
        suffixList.add(strToBytes32("verida"));
    }

    /**
     * @dev register name & DID
     * @param name user name is 32bytes string. It's a hash value. Duplication not allowed
     * @param did DID address.
     * @param signature - Signature provided by transaction creator
     */
    function register(bytes32 name, address did, bytes calldata signature) external onlyVerifiedSignature(did, signature) onlyValidSuffix(name){
        require(did != address(0x0), "Invalid zero address");
        require(_nameToDID[name] == address(0x0), "Name already registered");
        
        EnumerableSet.Bytes32Set storage didUserNameList = _DIDInfoList[did];
        
        _nameToDID[name] = did;
        didUserNameList.add(name);

        emit Register(name, did);
    }

    /**
     * @dev unregister name
     * @param name user name. Must be registered before
     * @param did DID address.
     * @param signature - Signature provided by transaction creator
     */
    function unregister(bytes32 name, address did, bytes calldata signature) external onlyVerifiedSignature(did, signature) {
        require(did != address(0x0), "Invalid zero address");

        address callerDID = _nameToDID[name];
        require(callerDID != address(0x0), "Unregistered name");

        require(callerDID == did, "Invalid DID");

        EnumerableSet.Bytes32Set storage didUserNameList = _DIDInfoList[callerDID];

        delete _nameToDID[name];
        didUserNameList.remove(name);

        emit Unregister(name, callerDID);
    }

    /**
     * @dev Find did for name
     * @param name user name. Must be registered
     * @return DID address of user
     */
    function findDid(bytes32 name) external view returns(address) {
        address callerDID = _nameToDID[name];
        require(callerDID != address(0x0), "Unregistered name");

        return callerDID;
    }

    /**
     * @dev Find name of DID
     * @param did Must be registered before.
     * @param signature - Signature provided by transaction creator
     * @return name
     */
    function getUserNameList(address did, bytes calldata signature) external view onlyVerifiedSignature(did, signature) returns(bytes32[] memory) {
        EnumerableSet.Bytes32Set storage didUserNameList = _DIDInfoList[did];

        uint256 length = didUserNameList.length();
        require(length > 0, "No registered DID");

        bytes32[] memory userNameList = new bytes32[](length);

        for (uint i = 0; i < length; i++) {
            userNameList[i] = didUserNameList.at(i);
        }

        return userNameList;
    }

    /**
     * @notice Add suffix for names
     * @dev Only the owner can add. 
     * Will be rejected if suffix already registered
     * @param suffix - Suffix to be added
     */

    function addSufix(bytes32 suffix) public onlyOwner {
        // bytes32 suffixConverted = strToBytes32(suffix);
        require(!suffixList.contains(suffix), "Already registered");

        suffixList.add(suffix);
    }

    /**
     * @notice Get Suffix from name
     * @dev Rejected if not found suffix
     * @param name - Input name
     * @return suffix - return suffix in bytes32
     */
    function getSuffix(bytes32 name) private pure returns(bytes32 suffix) {
        uint8 startIndex = 32;
        uint8 endIndex = 32;
        uint8 index = 31;
        while (index >= 0 && startIndex > 31) {
            if (endIndex > 31 && name[index] != 0x0) {
                endIndex = index;
            }

            // Find a "."
            if (name[index] == 0x2E) {
                startIndex = index + 1;
            }

            index--;
        }
        require(startIndex < 32, "No Suffix");

        bytes memory suffixBytes = new bytes(endIndex - startIndex + 1);

        for (index = startIndex; index <= endIndex; index++) {
            suffixBytes[index - startIndex] = name[index];
        }


        assembly {
            suffix := mload(add(suffixBytes, 32))
        }
    }

    /**
     * @notice Convert String to Bytes32
     * @param source - Input string
     * @return result - Converted Bytes32
     */
    function strToBytes32(string memory source) private pure returns(bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }

        assembly {
            result := mload(add(source, 32))
        }
    }

    /**
     * @notice Convert Bytes32 to String
     * @param did - Input value
     * @return string
     */
    function bytes32ToString(bytes32 did) private pure returns(string memory) {
        string memory converted = string(abi.encodePacked(did));
        return converted;
    }

}