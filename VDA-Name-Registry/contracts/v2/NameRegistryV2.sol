//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../v1/NameRegistry.sol";
import "./INameRegistryV2.sol";

contract NameRegistryV2 is NameRegistry, INameRegistryV2 {

    using EnumerableSet for EnumerableSet.StringSet;
    using StringLib for string;

    /**
     * @notice Used to managed the regisgered status of ownerName and appName
     * @param registered true if registered before
     * @param DID matched DID
     */
    struct AppRelatedNameInfo {
        bool registered;
        address DID;
    }
    
    /**
     * @notice DID to owner name
     */
    mapping (address => string) internal _didOwnerName;

    /**
     * @notice DID to App name list
     */
    mapping (address => EnumerableSet.StringSet) internal _didApps;

    /**
     * @notice owner name registered status
     */
    mapping (string => AppRelatedNameInfo) internal _ownerNameInfo;

    /**
     * @notice app name registered status
     */
    mapping (string => AppRelatedNameInfo) internal _appNameInfo;

    /**
     * @notice Map of appName => (meta key => meta value)
     * @dev App name is unique in the contract, so we can manage metadata without DID and ownername
     */
    mapping (string => AppMetaDataItem[]) internal _appMetaData;


    /*
     * @notice Gap for later use
     */
    uint256[50] private __gap;

    error InvalidOwnerName();
    error DuplicatedOwnerName();
    error InvalidAppName();
    error DuplicatedAppName();
    error NoDomainInAppMetaData();

    // /**
    //  * @notice Check the validity of the `appName` or `ownerName` in the `registerApp()` function
    //  * @param name Name to be checked
    //  * @return bool true if valid.
    //  */
    // function _isValidAppRegisterName(string calldata name) internal pure returns(bool){
    //     bytes memory nameBytes = bytes(name);
    //     uint len = nameBytes.length;

    //     for (uint i; i < len;) {
    //         bytes1 char = nameBytes[i];
    //         if (!(char >= 0x41 && char <= 0x5a) && char != 0x20) {
    //             return false;
    //         } 

    //         unchecked {
    //             ++i;
    //         }
    //     }
    //     return true;
    // }

    /**
     * @notice Check the name containse alphanumeric characters(including space) and make name to lowercase
     * @dev Used to check the owner name and app name in the `registerApp()` function
     * @param name Name to be checked
     * @return bool true if the name is valid
     * @return string Name that is converted to lowercase
     */
    function _validateAndLowerName(string calldata name) internal pure virtual returns(bool, string memory) {
        bytes memory nameBytes = bytes(name);
        uint len = nameBytes.length;
        bytes1 char;

        for (uint i; i < len;) {
            char = nameBytes[i];
            if (char >= 0x41 && char <= 0x5A) {
                nameBytes[i] = bytes1(uint8(char) + 32);
            } else if (!(char >= 0x61 && char <= 0x71) && char != 0x20 ) {
                return (false, "");
            }
            unchecked {
                ++i;
            }
        }
        return (true, string(nameBytes));
    }

    function _validateOwnerName(address did, string calldata ownerName) internal virtual returns(string memory) {
        bool isValid;
        string memory _ownerName;
        // Check validity of characters
        (isValid, _ownerName) = _validateAndLowerName(ownerName);
        if (!isValid) {
            revert InvalidOwnerName();
        }

        AppRelatedNameInfo storage status = _ownerNameInfo[_ownerName];

        if (status.registered && status.DID != did) {
            revert DuplicatedOwnerName();
        }
        
        if (!status.registered) {
            _didOwnerName[did] = _ownerName;
            status.registered = true;
            status.DID = did;
        }

        return _ownerName;
    }

    function _validateAppName(address did, string calldata appName) internal virtual returns(string memory) {
        bool isValid;
        string memory _appName;
        // Check validity of characters
        (isValid, _appName) = _validateAndLowerName(appName);
        if (!isValid) {
            revert InvalidAppName();
        }

        AppRelatedNameInfo storage status = _appNameInfo[_appName];

        if (status.registered) {
            revert DuplicatedAppName();
        }
        
        _didOwnerName[did] = _ownerName;
        status.registered = true;
        status.DID = did;
        
        return _appName;
    }

    /**
     * @notice Validate `metadata` of the `registerApp()` function and returns packed data
     * @dev The packed meta data is used to veryf the request
     * @param metadata App meta data
     * @return bytes Packed meta data
     */
    function _getAppMetaDataPacked(AppMetaDataItem[] calldata metadata) internal pure virtual returns(bytes memory) {
        uint len = metadata.length;
        bytes memory ret;
        bool isValid;

        bytes32 domainKey = keccak256(bytes("domain"));

        for (uint i; i < len;) {
            if (keccak256(bytes(metadata[i].key)) == domainKey) {
                isValid = true;
                // To-do : Check domain name format here

            }
            ret = abi.encodePacked(ret, metadata[i].key, metadata[i].value);
            unchecked {
                ++i;
            }
        }

        if (!isValid) {
            revert NoDomainInAppMetaData();
        }

        return ret;
    }

    /**
     * @notice Verify whether a given request is valid. Verifies the nonce of the DID making the request.
     * @dev Verify the signature & proof signed by valid signers
     * @param did DID that made the request. Nonce will be incremented against this DID to avoid replay attacks.
     * @param params Parameters of the message.
     * @param signature A signature that matches sign(${didSignAddress}, params)
     * @param proof Proof A signature that matches sign(did, `${didAddress}${didSignAddress}`)
     */
    function verifyRequest(
        address did, 
        bytes memory params, 
        bytes memory signature, 
        bytes memory proof
    ) internal virtual {
        // Verify the nonce is valid by including it in the unsignedData to be checked
        uint didNonce = _nonce[did];
        bytes memory unsignedParams = abi.encodePacked(
            params,
            didNonce
        );

        address[] memory signers = new address[](1);
        signers[0] = did;

        // Verify the params were signed by the DID making the request
        VeridaDataVerificationLib.verifyDataWithSigners(
            unsignedParams,
            signature,
            proof,
            signers
        );

        // Increment the nonce to prevent replay attacks
        ++_nonce[did];
    }
    
    /**
     * @dev See {INameRegistryV2}
     */
    function registerApp(
        address did,
        string calldata ownerName,
        string calldata appName,
        AppMetaDataItem[] calldata metadata,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external virtual override {
        string memory _ownerName;
        string memory _appName;
        // Check input values and verify request
        {
            

            (isValid, _appName) = _validateAndLowerName(appName);
            if (!isValid) {
                revert InvalidAppName();
            }

            bytes memory params = _getAppMetaDataPacked(metadata);
            params = abi.encodePacked(did, ownerName, appName, params);

            verifyRequest(did, params, requestSignature, requestProof);
        }




        
    }

    /**
     * @dev See {INameRegistryV2}
     */
    function deregisterApp(
        address did, 
        string calldata ownerName, 
        string calldata appName,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external virtual override {

    }

    /**
     * @dev See {INameRegistryV2}
     */
    function updateApp(
        address did, 
        string calldata ownerName,
        string calldata appName,
        AppMetaDataItem calldata item,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external virtual override {

    }

    /**
     * @dev See {INameRegistryV2}
     */
    function getApp(string calldata ownerName, string calldata appName) external view virtual override returns(address, AppMetaDataItem[] memory) {

    }


    /**
     * @dev See {INameRegistryV2}
     */
    function setTokenAddress(IERC20Upgradeable tokenAddr) external virtual payable override {

    }

    /**
     * @dev See {INameRegistryV2}
     */
    function getTokenAddress() external view virtual override returns(address) {

    }

    /**
     * @dev See {INameRegistryV2}
     */
    function updateAppRegisterFee(uint feeAmount) external virtual payable override {

    }

    /**
     * @dev See {INameRegistryV2}
     */
    function enableAppRegister(bool isEnabled) external virtual payable override {

    }

    /**
     * @dev See {INameRegistryV2}
     */
    function isAppRegisterEnabled() external view virtual override returns(bool) {

    }

}