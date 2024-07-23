//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// Verida contract dependencies
import "@verida/common-contract/contracts/EnumerableSet.sol";
import "@verida/common-contract/contracts/StringLib.sol";
import "./INameRegistry.sol";
import "../VeridaDataVerificationLib.sol";

/**
 * @title Verida NameRegistry contract
 */
contract NameRegistry is  INameRegistry, OwnableUpgradeable {

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

    // Custom errors
    error InvalidAddress();
    error InvalidSuffix();
    // error InvalidSignature();
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
     * @dev See {INameRegistry}
     */
    function nonce(address did) external view virtual override returns(uint) {
        return _nonce[did];
    }

    /**
     * @dev See {INameRegistry}
     */
    function register(string calldata name, address did, bytes calldata signature) external virtual override {
        assembly {
            if iszero(did) {
                let ptr := mload(0x40)
                mstore(ptr, 0xe6c4247b00000000000000000000000000000000000000000000000000000000)
                revert(ptr, 0x4) //revert InvalidAddress()
            }
        }
        if(!_isValidSuffix(name)) {
            revert InvalidSuffix();
        }

        {
            uint didNonce = _nonce[did];
            bytes memory paramData = abi.encodePacked(
                name,
                did,
                didNonce
            );

            if (!VeridaDataVerificationLib.validateSignature(paramData, signature, did)) {
                revert InvalidSignature();
            }
            ++_nonce[did];
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
     * @dev See {INameRegistry}
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
            uint didNonce = _nonce[did];
            bytes memory paramData = abi.encodePacked(
                name,
                did,
                didNonce
            );

            if (!VeridaDataVerificationLib.validateSignature(paramData, signature, did)) {
                revert InvalidSignature();
            }
            ++_nonce[did];
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
     * @dev See {INameRegistry}
     */
    function findDID(string memory name) external view virtual override returns(address) {
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
     * @dev See {INameRegistry}
     */
    function getUserNameList(address did) external view virtual override returns(string[] memory) {
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
     * @dev See {INameRegistry}
     */
    function addSuffix(string memory suffix) external virtual payable override onlyOwner {
        suffix = suffix.lower();

        if (suffixList.contains(suffix)) {
            revert InvalidSuffix();
        }

        suffixList.add(suffix);

        emit AddSuffix(suffix);
    }

    /**
     * @notice Check whether name has valid suffix
     * @dev Check all the letters of name inside _getSuffix() function
     * @param name - name to check
     * @return result
     */
    function _isValidSuffix(string calldata name) internal view virtual returns(bool) {
        string memory suffix = _getSuffix(name);
        return suffixList.contains(suffix);
    }

    /**
     * @dev See {INameRegistry}
     */
    function isValidSuffix(string calldata suffix) external view virtual override returns(bool) {
        string memory lower = suffix.lower();
        return suffixList.contains(lower);
    }

    /**
     * @notice Get Suffix from name
     * @dev Rejected if name contains invalid characters or not found suffix.
     * @param name - Input name
     * @return suffix - return suffix in bytes32
     */
    function _getSuffix(string calldata name) internal pure virtual returns(string memory suffix) {
        string memory _name = name.lower();
        bytes memory nameBytes = bytes(_name);
        if (nameBytes.length == 0) {
            revert InvalidName();
        }

        uint len = nameBytes.length;

        uint startIndex = len;
        uint index;
        uint8 dotCount;
        while (index < len && dotCount < 2 && _isValidCharacter(nameBytes[index])) {
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
     * @dev See {INameRegistry}
     */
    function getSuffixList() external view virtual override returns(string[] memory) {
        uint len = suffixList.length();
        string[] memory list = new string[](len);
        for (uint i; i < len;) {
            list[i] = suffixList.at(i);
            unchecked {
                ++i;
            }
        }
        return list;
    }

    /**
     * @notice Check whether character is allowed in NameRegistry
     * @param char - one byte from name string value
     * @return - true if valid.
     */
    function _isValidCharacter(bytes1 char) internal pure virtual returns(bool) {
        if (char >= 0x61 && char <= 0x7a)
            return true;
        if (char >= 0x30 && char <= 0x39)
            return true;
        if (char ==0x5f || char == 0x2d || char == 0x2e)
            return true;
        return false;
    }

    /**
     * @dev See {INameRegistry}
     */
    function updateMaxNamesPerDID(uint count) external virtual payable onlyOwner {
        uint orgValue = maxNamesPerDID;
        if (count <= orgValue) {
            revert InvalidNameCount();
        }
        maxNamesPerDID = count;

        emit UpdateMaxNamesPerDID(orgValue, count);
    }
}