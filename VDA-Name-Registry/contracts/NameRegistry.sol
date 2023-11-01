//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// Verida contract dependencies
import "@verida/common-contract/contracts/EnumerableSet.sol";
import "@verida/common-contract/contracts/StringLib.sol";
import "./VeridaDataVerificationLib.sol";


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
     * @notice username to did
     */
    mapping(string => address) internal _nameToDID;
    
    /** 
     * @notice DID to username list
     */
    mapping(address => EnumerableSet.StringSet) internal _DIDInfoList;

    /**
     * @notice Allowed suffix list
     */
    EnumerableSet.StringSet internal suffixList;

    /**
     * @notice Maximum names per DID.
     */
    uint public maxNamesPerDID;

    /**
     * @notice Gap for later use
     */
    uint256[20] private __gap;

    event Register(string indexed name, address indexed DID);
    event Unregister(string indexed name, address indexed DID);
    event AddSuffix(string indexed suffix);
    event UpdateMaxNamesPerDID(uint from, uint to);

    // Custom errors
    error InvalidAddress();
    error InvalidSuffix();
    error InvalidSignature();
    error InvalidName();
    error LimitedNameCount();
    error InvalidNameCount();

    /**
     * @notice Initialize
     */
    function initialize() public initializer {
        __Ownable_init();

        maxNamesPerDID = 1;

        string memory suffix = "vda";
        suffixList.add(suffix);
        emit AddSuffix(suffix);
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
    function register(string calldata name, address did, bytes calldata signature) external virtual {
        assembly {
            if iszero(did) {
                let ptr := mload(0x40)
                mstore(ptr, 0xe6c4247b00000000000000000000000000000000000000000000000000000000)
                revert(ptr, 0x4) //revert InvalidAddress()
            }
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
        {
            // Check _nameToDID[_name] is zero
            address _nameDID = _nameToDID[_name];
            assembly {
                if eq(iszero(_nameDID), 0) {
                    let ptr := mload(0x40)
                    mstore(ptr, 0x430f13b300000000000000000000000000000000000000000000000000000000)
                    revert(ptr, 0x4) //revert InvalidName()
                }
            }
        }
        
        EnumerableSet.StringSet storage didUserNameList = _DIDInfoList[did];

        if (didUserNameList.length() >= maxNamesPerDID) {
            revert LimitedNameCount();
        }
        
        _nameToDID[_name] = did;
        didUserNameList.add(_name);

        emit Register(name, did);
    }

    /**
     * @dev unregister name
     * @param name user name. Must be registered before
     * @param did DID address.
     * @param signature - Signature provided by transaction creator
     */
    function unregister(string calldata name, address did, bytes calldata signature) external virtual {
        assembly {
            if iszero(did) {
                let ptr := mload(0x40)
                mstore(ptr, 0xe6c4247b00000000000000000000000000000000000000000000000000000000)
                revert(ptr, 0x4) // revert InvalidAddress()
            }
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

        address nameDID = _nameToDID[_name];
        assembly {
            if iszero(nameDID) {
                let ptr := mload(0x40)
                mstore(ptr, 0x430f13b300000000000000000000000000000000000000000000000000000000)
                revert(ptr, 0x4) // revert InvalidName()
            }
        }

        if (nameDID != did) {
            revert InvalidAddress();
        }
        
        EnumerableSet.StringSet storage didUserNameList = _DIDInfoList[nameDID];

        delete _nameToDID[_name];
        didUserNameList.remove(_name);

        emit Unregister(name, nameDID);
    }

    /**
     * @dev Find did for name
     * @param name user name. Must be registered
     * @return DID address of user
     */
    function findDID(string memory name) external view virtual returns(address) {
        name = name.lower();

        address nameDID = _nameToDID[name];
        assembly {
            if iszero(nameDID) {
                let ptr := mload(0x40)
                mstore(ptr, 0x430f13b300000000000000000000000000000000000000000000000000000000)
                revert(ptr, 0x4) // revert InvalidName()
            }
        }

        return nameDID;
    }

    /**
     * @dev Find name of DID
     * @param did Must be registered before.
     * @return name
     */
    function getUserNameList(address did) external view virtual returns(string[] memory) {
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
    function addSuffix(string memory suffix) external virtual payable onlyOwner {
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
    function isValidSuffix(string calldata name) internal view virtual returns(bool) {
        string memory suffix = getSuffix(name);
        return suffixList.contains(suffix);
    }

    /**
     * @notice Get Suffix from name
     * @dev Rejected if name contains invalid characters or not found suffix.
     * @param name - Input name
     * @return suffix - return suffix in bytes32
     */
    function getSuffix(string calldata name) internal pure virtual returns(string memory suffix) {
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
    function isValidCharacter(bytes1 char) internal pure virtual returns(bool) {
        if (char >= 0x61 && char <= 0x7a)
            return true;
        if (char >= 0x30 && char <= 0x39)
            return true;
        if (char ==0x5f || char == 0x2d || char == 0x2e)
            return true;
        return false;
    }

    function updateMaxNamesPerDID(uint count) external virtual payable onlyOwner {
        uint orgValue = maxNamesPerDID;
        if (count <= orgValue) {
            revert InvalidNameCount();
        }
        maxNamesPerDID = count;

        emit UpdateMaxNamesPerDID(orgValue, count);
    }
}