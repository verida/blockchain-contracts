//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// Verida contract dependencies
import "@verida/common-contract/contracts/EnumerableSet.sol";
import "@verida/common-contract/contracts/StringLib.sol";
import "./VeridaDataVerificationLib.sol";

// import "hardhat/console.sol";

error InvalidAddress();
error InvalidSuffix();
error InvalidSignature();
error InvalidName();
error LimitedNameCount();
error InvalidNameCount();

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
        if (did == address(0x0)) {
            revert InvalidAddress();
        }
        if(!isValidSuffix(name)) {
            revert InvalidSuffix();
        }

        {
            uint didNonce = nonce(did);
            bytes memory paramData = abi.encodePacked(
                name,
                did,
                didNonce
            );

            if (!VeridaDataVerificationLib.validateSignature(paramData, signature, did)) {
                revert InvalidSignature();
            }
        }

        string memory _name = name.lower();
        if (_nameToDID[_name] != address(0x0)) {
            revert InvalidName();
        }
        
        EnumerableSet.StringSet storage didUserNameList = _DIDInfoList[did];

        if (didUserNameList.length() >= maxNamesPerDID) {
            revert LimitedNameCount();
        }
        
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
        if (did == address(0x0)) {
            revert InvalidAddress();
        }

        {
            uint didNonce = nonce(did);
            bytes memory paramData = abi.encodePacked(
                name,
                did,
                didNonce
            );

            if (!VeridaDataVerificationLib.validateSignature(paramData, signature, did)) {
                revert InvalidSignature();
            }
        }
        
        string memory _name = name.lower();

        address callerDID = _nameToDID[_name];
        if (callerDID == address(0x0)) {
            revert InvalidName();
        }

        if (callerDID != did) {
            revert InvalidAddress();
        }
        
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
        if (callerDID == address(0x0)) {
            revert InvalidName();
        }

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
        if (length == 0) {
            revert InvalidAddress();
        }

        string[] memory userNameList = new string[](length);

        for (uint i; i < length;) {
            userNameList[i] = didUserNameList.at(i);
            unchecked { ++i; }
        }

        return userNameList;
    }

    /**
     * @notice Add suffix for names
     * @dev Only the owner can add. 
     * Will be rejected if suffix already registered
     * @param suffix - Suffix to be added
     */

    function addSufix(string memory suffix) external payable onlyOwner {
        suffix = suffix.lower();

        if (suffixList.contains(suffix)) {
            revert InvalidSuffix();
        }

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
        if (nameBytes.length == 0) {
            revert InvalidName();
        }

        uint len = nameBytes.length;

        uint startIndex = len;
        uint index;
        uint8 dotCount;
        while (index < len && dotCount < 2 && isValidCharacter(nameBytes[index])) {
            // Find a "."
            unchecked {
                if (nameBytes[index] == 0x2E) {
                    startIndex = index + 1;
                    ++dotCount;
                }

                ++index;
            }
        }
        // nameLen = startIndex;
        if (startIndex >= len) {
            revert InvalidName();
        }

        if (dotCount > 1 || index != len || startIndex <= 2 || startIndex >= 34) {
            revert InvalidName();
        }

        bytes memory suffixBytes = new bytes(len - startIndex);

        for (index = startIndex; index < len;) {
            suffixBytes[index - startIndex] = nameBytes[index];
            unchecked { ++index; }
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

    function updateMaxNamesPerDID(uint count) external payable onlyOwner {
        uint orgValue = maxNamesPerDID;
        if (count <= orgValue) {
            revert InvalidNameCount();
        }
        maxNamesPerDID = count;

        emit UpdateMaxNamesPerDID(orgValue, count);
    }
}