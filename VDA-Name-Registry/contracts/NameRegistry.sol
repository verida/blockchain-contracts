//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// Verida contract dependencies
import "@verida/common-contract/contracts/EnumerableSet.sol";
import "@verida/common-contract/contracts/StringLib.sol";
import "./VeridaDataVerificationLib.sol";

// import "hardhat/console.sol";
/**
 * @title Verida NameRegistry contract
 */
contract NameRegistry is  OwnableUpgradeable {

    using EnumerableSet for EnumerableSet.StringSet;
    using StringLib for string;

    /**
     * @notice nonce for did
     */
    mapping(address => uint) internal _nonce;

    /**
     * @notice Maximum names per DID.
     */
    uint public maxNamesPerDID;

    /**
     * @notice username to did
     */
    mapping(string => address) private _nameToDID;

    /**
     * @notice Allowed suffix list
     */
    EnumerableSet.StringSet private suffixList;

    /** 
     * @notice DID to username list
     */
    mapping(address => EnumerableSet.StringSet) private _DIDInfoList;

    event Register(string indexed name, address indexed DID);
    event Unregister(string indexed name, address indexed DID);
    event AddSuffix(string indexed suffix);
    event UpdateMaxNamesPerDID(uint from, uint to);

    /**
     * @notice Initialize
     */
    function initialize() public initializer {
        __Ownable_init();
        suffixList.add("vda");
        maxNamesPerDID = 1;
    }

    /**
     * @dev return nonce of a did
     * @param did DID address
     */
    function nonce(address did) public view returns(uint) {
        return _nonce[did];
    }

    /**
     * @notice register name & DID
     * @dev Check validity of name inside the isValidSuffix() function
     * @param name user name. Duplication not allowed
     * @param did DID address.
     * @param signature - Signature provided by transaction creator
     */
    function register(string calldata name, address did, bytes calldata signature) external {
        require(did != address(0x0), "Invalid zero address");
        require(isValidSuffix(name), "Invalid suffix");

        {
            uint didNonce = nonce(did);
            bytes memory paramData = abi.encodePacked(
                name,
                did,
                didNonce
            );

            require(VeridaDataVerificationLib.validateSignature(paramData, signature, did), "Invalid Signature");
        }

        string memory _name = name.lower();
        require(_nameToDID[_name] == address(0x0), "Name already registered");
        
        EnumerableSet.StringSet storage didUserNameList = _DIDInfoList[did];

        require(didUserNameList.length() < maxNamesPerDID, "DID can not support any more names");
        
        _nameToDID[_name] = did;
        // To-do(Alex) : Check for upper & lower case strings
        // nameBytes = strToBytes32(_name);
        didUserNameList.add(_name);

        emit Register(name, did);
    }

    /**
     * @dev unregister name
     * @param name user name. Must be registered before
     * @param did DID address.
     * @param signature - Signature provided by transaction creator
     */
    function unregister(string calldata name, address did, bytes calldata signature) external {
        require(did != address(0x0), "Invalid zero address");

        {
            uint didNonce = nonce(did);
            bytes memory paramData = abi.encodePacked(
                name,
                did,
                didNonce
            );

            require(VeridaDataVerificationLib.validateSignature(paramData, signature, did), "Invalid Signature");
        }
        
        string memory _name = name.lower();

        address callerDID = _nameToDID[_name];
        require(callerDID != address(0x0), "Unregistered name");

        require(callerDID == did, "Invalid DID");
        
        EnumerableSet.StringSet storage didUserNameList = _DIDInfoList[callerDID];

        delete _nameToDID[_name];
        // To-do(Alex) : Check for upper & lower case strings
        // nameBytes = strToBytes32(_name);
        didUserNameList.remove(_name);

        emit Unregister(name, callerDID);
    }

    /**
     * @dev Find did for name
     * @param name user name. Must be registered
     * @return DID address of user
     */
    function findDID(string memory name) external view returns(address) {
        name = name.lower();

        address callerDID = _nameToDID[name];
        require(callerDID != address(0x0), "Unregistered name");

        return callerDID;
    }

    /**
     * @dev Find name of DID
     * @param did Must be registered before.
     * @return name
     */
    function getUserNameList(address did) external view returns(string[] memory) {
        EnumerableSet.StringSet storage didUserNameList = _DIDInfoList[did];

        uint256 length = didUserNameList.length();
        require(length > 0, "No registered DID");

        string[] memory userNameList = new string[](length);

        for (uint i; i < length; i++) {
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

    function addSufix(string memory suffix) external onlyOwner {
        suffix = suffix.lower();

        require(!suffixList.contains(suffix), "Already registered");

        suffixList.add(suffix);

        emit AddSuffix(suffix);
    }

    /**
     * @notice Check whether name has valid suffix
     * @dev Check all the letters of name inside getSuffix() function
     * @param name - name to check
     * @return result
     */
    function isValidSuffix(string calldata name) private view returns(bool) {
        string memory suffix = getSuffix(name);
        return suffixList.contains(suffix);
    }

    /**
     * @notice Get Suffix from name
     * @dev Rejected if name contains invalid characters or not found suffix.
     * @param name - Input name
     * @return suffix - return suffix in bytes32
     */
    function getSuffix(string calldata name) private pure returns(string memory suffix) {
        string memory _name = name.lower();
        bytes memory nameBytes = bytes(_name);
        require(nameBytes.length > 0, "No Suffix");


        uint len = nameBytes.length;

        uint startIndex = len;
        uint index;
        uint8 dotCount;
        while (index < len && dotCount < 2 && isValidCharacter(nameBytes[index])) {
            // Find a "."
            if (nameBytes[index] == 0x2E) {
                startIndex = index + 1;
                dotCount++;
            }

            index++;
        }
        require(dotCount < 2 && index == len, "Invalid character specified in name");
        require(startIndex < len, "No Suffix");
        // uint nameLen = startIndex;

        require(startIndex > 2 && startIndex < 34, "Invalid name length");

        bytes memory suffixBytes = new bytes(len - startIndex);

        for (index = startIndex; index < len; index++) {
            suffixBytes[index - startIndex] = nameBytes[index];
        }

        suffix = string(suffixBytes);
    }

    /**
     * @notice Check whether character is allowed in NameRegistry
     * @param char - one byte from name string value
     * @return - true if valid.
     */
    function isValidCharacter(bytes1 char) private pure returns(bool) {
        if (char >= 0x61 && char <= 0x7a)
            return true;
        if (char >= 0x30 && char <= 0x39)
            return true;
        if (char ==0x5f || char == 0x2d || char == 0x2e)
            return true;
        return false;
    }

    function updateMaxNamesPerDID(uint count) external onlyOwner {
        require(count > 0, "Zero not allowed");
        uint orgValue = maxNamesPerDID;
        maxNamesPerDID = count;

        emit UpdateMaxNamesPerDID(orgValue, count);
    }
}