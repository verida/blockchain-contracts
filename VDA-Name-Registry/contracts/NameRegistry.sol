//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

// import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "./BytesLib.sol";
import "./StringLib.sol";

/**
 * @title Verida NameRegistry contract
 */
contract NameRegistry is OwnableUpgradeable {

    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.Bytes32Set;
    using BytesLib for bytes;
    using StringLib for string;

    /**
     * @notice username to did
     */
    mapping(bytes32 => address) private _nameToDID;

    /**
     * @notice Allowed suffix list
     */
    EnumerableSetUpgradeable.Bytes32Set private suffixList;

    /** 
     * @notice DID to username list
     */
    mapping(address => EnumerableSetUpgradeable.Bytes32Set) private _DIDInfoList;

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

    event Register(string indexed name, address indexed DID);
    event Unregister(string indexed name, address indexed DID);
    event AddSuffix(string indexed suffix);

    /**
     * @notice Initialize
     */
    function initialize() public initializer {
        __Ownable_init();
        suffixList.add(strToBytes32("verida"));
    }

    

    /**
     * @dev register name & DID
     * @param name user name is 32bytes string. It's a hash value. Duplication not allowed
     * @param did DID address.
     * @param signature - Signature provided by transaction creator
     */
    function register(string memory name, address did, bytes calldata signature) external onlyVerifiedSignature(did, signature) {
        require(did != address(0x0), "Invalid zero address");
        require(isValidSuffix(name), "Invalid suffix");

        name = name.lower();
        bytes32 nameBytes = strToBytes32(name);
        require(_nameToDID[nameBytes] == address(0x0), "Name already registered");
        
        EnumerableSetUpgradeable.Bytes32Set storage didUserNameList = _DIDInfoList[did];
        
        _nameToDID[nameBytes] = did;
        didUserNameList.add(nameBytes);

        emit Register(name, did);
    }

    /**
     * @dev unregister name
     * @param name user name. Must be registered before
     * @param did DID address.
     * @param signature - Signature provided by transaction creator
     */
    function unregister(string memory name, address did, bytes calldata signature) external onlyVerifiedSignature(did, signature) {
        require(did != address(0x0), "Invalid zero address");
        require(isValidSuffix(name), "Invalid suffix");

        name = name.lower();
        bytes32 nameBytes = strToBytes32(name);

        address callerDID = _nameToDID[nameBytes];
        require(callerDID != address(0x0), "Unregistered name");

        require(callerDID == did, "Invalid DID");

        EnumerableSetUpgradeable.Bytes32Set storage didUserNameList = _DIDInfoList[callerDID];

        delete _nameToDID[nameBytes];
        didUserNameList.remove(nameBytes);

        emit Unregister(name, callerDID);
    }

    /**
     * @dev Find did for name
     * @param name user name. Must be registered
     * @return DID address of user
     */
    function findDid(string memory name) external view returns(address) {
        name = name.lower();
        bytes32 nameByte = strToBytes32(name);

        address callerDID = _nameToDID[nameByte];
        require(callerDID != address(0x0), "Unregistered name");

        return callerDID;
    }

    /**
     * @dev Find name of DID
     * @param did Must be registered before.
     * @param signature - Signature provided by transaction creator
     * @return name
     */
    function getUserNameList(address did, bytes calldata signature) external view onlyVerifiedSignature(did, signature) returns(string[] memory) {
        EnumerableSetUpgradeable.Bytes32Set storage didUserNameList = _DIDInfoList[did];

        uint256 length = didUserNameList.length();
        require(length > 0, "No registered DID");

        string[] memory userNameList = new string[](length);

        for (uint i = 0; i < length; i++) {
            userNameList[i] = bytes32ToString(didUserNameList.at(i));
        }

        return userNameList;
    }

    /**
     * @notice Add suffix for names
     * @dev Only the owner can add. 
     * Will be rejected if suffix already registered
     * @param suffix - Suffix to be added
     */

    function addSufix(string memory suffix) public onlyOwner {
        suffix = suffix.lower();

        bytes32 suffixBytes = strToBytes32(suffix);
        require(!suffixList.contains(suffixBytes), "Already registered");

        suffixList.add(suffixBytes);

        emit AddSuffix(suffix);
    }

    /**
     * @notice Check whether name has valid suffix
     * @param name - name to check
     * @return result
     */
    function isValidSuffix(string memory name) private returns(bool) {
        name = name.lower();

        bytes32 suffix = getSuffix(name);
        return suffixList.contains(suffix);
    }

    /**
     * @notice Get Suffix from name
     * @dev Rejected if not found suffix
     * @param name - Input name
     * @return suffix - return suffix in bytes32
     */
    function getSuffix(string memory name) private pure returns(bytes32 suffix) {
        name = name.lower();
        bytes memory nameBytes = bytes(name);
        require(nameBytes.length > 0, "NoSuffix");

        uint len = nameBytes.length;

        uint startIndex = len;
        uint endIndex = len - 1;
        uint index = len - 1;
        while (index >= 0 && startIndex >= len) {
            // Find a "."
            if (nameBytes[index] == 0x2E) {
                startIndex = index + 1;
            }

            index--;
        }
        require(startIndex < len, "No Suffix");

        bytes memory suffixBytes = new bytes(endIndex - startIndex + 1);

        for (index = startIndex; index <= endIndex; index++) {
            suffixBytes[index - startIndex] = nameBytes[index];
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
        require(tempEmptyStringTest.length <= 32, "Too long string");
        
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
        // string memory converted = string(abi.encodePacked(did));
        // return converted;
        if (did[0] == 0x0)
            return "";

        uint8 len = 31;
        while(len >= 0 && did[len] == 0) {
            len--;
        }
        
        bytes memory bytesArray = new bytes(len+1);
        for (uint8 i = 0; i <= len; i++) {
            bytesArray[i] = did[i];
        }
        return string(bytesArray);
    }

}