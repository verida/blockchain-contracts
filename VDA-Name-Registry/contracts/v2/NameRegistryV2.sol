//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../v1/NameRegistry.sol";
import "./INameRegistryV2.sol";

// import "hardhat/console.sol";

contract NameRegistryV2 is NameRegistry, INameRegistryV2 {

    using EnumerableSet for EnumerableSet.StringSet;
    using StringLib for string;

    /**
     * @notice Used to managed the regisgered status of ownerName and appName
     * @param registered true if registered before
     * @param DID matched DID
     */
    struct OwnerNameInfo {
        bool registered;
        address DID;
    }
    
    /**
     * @notice DID to owner name
     */
    mapping (address => string) internal _didOwnerName;

    /**
     * @notice owner name registered status
     * @dev Owner name is unique in the contract. 1:1 matched to the DID
     */
    mapping (string => OwnerNameInfo) internal _ownerNameInfo;

    /**
     * @notice DID to App name list
     */
    mapping (address => EnumerableSet.StringSet) internal _didApps;

    /**
     * @notice Meta data list of a DID's appName
     * @dev App name is unique in a DID's app name list. DID => app name => 
     */
    mapping (address => mapping(string => AppMetaDataItem[])) internal _didAppMetaData;

    /**
     * @notice Verida token address
     * @dev Used to pay the fees while registering an application
     */
    IERC20Upgradeable internal vdaToken;

    /**
     * @notice Fee for registering app
     */
    uint internal appRegisterFee;

    bool internal _isAppRegisterEnabled;

    /*
     * @notice Gap for later use
     */
    uint256[50] private __gap;

    error AppRegisterNotEnabled();
    error InvalidOwnerName();
    error DuplicatedOwnerName();
    error InvalidAppName();
    error DuplicatedAppName();
    error InvalidDomainName();
    error AppNotFound(bool isInvalidOwner, bool isInvalidApp);
    error NoDomainInAppMetaData();
    error InvalidValue();
    error TokenAddressNotSet();
    error AppRegisterFeeNotSet();

    /**
     * @notice Check a lower-cased string whether contains [a-z] and allowed special characters
     * @param input Lower-cased string
     * @param allowedCharacters String of allowed special characters
     * @return bool true if valid
     */
    function _isValidString(string memory input, string memory allowedCharacters) internal pure virtual returns(bool) {
        bytes memory inputBytes = bytes(input);
        uint len = inputBytes.length;
        bytes1 char;
        if (len == 0) {
            return false;
        }
        bytes memory specialChars = bytes(allowedCharacters);
        uint specLen = specialChars.length;

        unchecked {
            for (uint i; i < len;) {
                char = inputBytes[i];
                if (!(char >= 0x61 && char <= 0x7a) && !(char >= 0x30 && char <= 0x39)) {
                    bool isSpecChar;
                    for (uint j; j < specLen;) {
                        if (char == specialChars[j]) {
                            isSpecChar = true;
                            break;
                        }
                        ++j;
                    }
                    if (!isSpecChar) {
                        return false;
                    }
                }
                ++i;
            }
        }

        return true;
    }

    /**
     * @notice Validate the owner name in the `registerApp()` function
     * @param did DID
     * @param ownerName Wwner name to be registered
     * @return string Lowercased owner name
     */
    function _validateOwnerName(address did, string calldata ownerName) internal virtual returns(string memory) {
        string memory _ownerName;
        _ownerName = ownerName.lower();

        // Check validity of characters
        if (!_isValidString(_ownerName, " ")) {
            revert InvalidOwnerName();
        }
        
        OwnerNameInfo storage status = _ownerNameInfo[_ownerName];
        // Check owner name is registered
        if (status.registered) {
            if (status.DID == did) {
                return _ownerName;
            } else {
                revert DuplicatedOwnerName();
            }
        }

        // Check DID has an owner name
        if (bytes(_didOwnerName[did]).length != 0) {
            // If DID has no owner name registered
            revert InvalidOwnerName();
        }

        return _ownerName;
    }

    /**
     * @notice Validate the app name in the `registerApp()` function
     * @param did DID
     * @param appName App name to be registered
     * @return string Lowercased app name
     */
    function _validateAppName(address did, string calldata appName) internal virtual returns(string memory) {
        string memory _appName;
        // Check validity of characters
        _appName = appName.lower();

        if (!_isValidString(_appName, " ")) {
            revert InvalidAppName();
        }

        if (_didApps[did].contains(_appName)) {
            revert DuplicatedAppName();
        }

        return _appName;
    }

    /**
     * @notice Validate `metadata` of the `registerApp()` function and returns packed data
     * @dev The packed meta data is used to verify the request
     * @param metadata App meta data
     * @return bytes Packed meta data
     */
    function _getAppMetaDataPacked(AppMetaDataItem[] calldata metadata) internal pure virtual returns(bytes memory) {
        uint len = metadata.length;
        bytes memory ret;
        bool isDomainIncluded;

        bytes32 domainKey = keccak256(bytes("domain"));

        for (uint i; i < len;) {
            if (keccak256(bytes(metadata[i].key)) == domainKey) {
                isDomainIncluded = true;
                if (!_isValidString(metadata[i].value, "_-")) {
                    revert InvalidDomainName();
                }
            }
            ret = abi.encodePacked(ret, metadata[i].key, metadata[i].value);
            unchecked {
                ++i;
            }
        }

        if (!isDomainIncluded) {
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
     * @notice Receive App registering fee
     * @dev Used in the `registerApp()` function
     *      No need to check token address here because `enableAppRegister()` checked it
     * @param from Address that pays the fee
     */
    function _receiveAppFee(address from) internal virtual {
        // To-do check fee can be 0
        if (appRegisterFee > 0) {
            vdaToken.transferFrom(from, address(this), appRegisterFee);
        }
    }

    /**
     * @notice Register app info to storage
     * @dev Used in the `registerApp()` function
     */
    function _registerAppInfo(
        address did,
        string memory ownerName,
        string memory appName,
        AppMetaDataItem[] calldata metadata
    ) internal virtual {
        // Register owner name
        _didOwnerName[did] = ownerName;
        _ownerNameInfo[ownerName].registered = true;
        _ownerNameInfo[ownerName].DID = did;

        // Register app name
        _didApps[did].add(appName);

        AppMetaDataItem[] storage appData = _didAppMetaData[did][appName];
        uint len = metadata.length;
        for (uint i; i < len;) {
            appData.push(metadata[i]);
            unchecked {
                ++i;
            }
        }
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

        if (!_isAppRegisterEnabled) {
            revert AppRegisterNotEnabled();
        }

        // Check input values and verify request
        {
            _ownerName = _validateOwnerName(did, ownerName);
            _appName = _validateAppName(did, appName);

            bytes memory params = _getAppMetaDataPacked(metadata);
            params = abi.encodePacked(did, ownerName, appName, params);

            verifyRequest(did, params, requestSignature, requestProof);
        }
        
        _receiveAppFee(tx.origin);

        _registerAppInfo(did, _ownerName, _appName, metadata);

        emit RegisterApp(did, ownerName, appName, metadata);
    }

    /**
     * @notice Check the owner name & app name are registered to the DID
     * @dev Used in `deregisterApp()` and `updateApp()` functions
     * @param did DID
     * @param ownerName Owner name - lowercased
     * @param appName App name - lowercased
     */
    function _validateExistingApp(
        address did,
        string memory ownerName,
        string memory appName
    ) internal view {

        if (_ownerNameInfo[ownerName].DID != did) {
            revert AppNotFound(true, false);
        }

        if (!_didApps[did].contains(appName)) {
            revert AppNotFound(false, true);
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
        string memory _ownerName;
        string memory _appName;

        _ownerName = ownerName.lower();
        _appName = appName.lower();

        
        // verify request
        {
            _validateExistingApp(did, _ownerName, _appName);

            bytes memory params = abi.encodePacked(did, ownerName, appName);
            verifyRequest(did, params, requestSignature, requestProof);
        }

        // de-register
        delete _didOwnerName[did];
        delete _ownerNameInfo[_ownerName];

        _didApps[did].remove(_appName);
        delete _didAppMetaData[did][_appName];

        emit DeregisterApp(did, _ownerName, _appName);
    }

    /**
     * @notice Compare 2 strings
     * @param left string
     * @param right string
     * @return bool true if equal
     */
    function _isSameString(string memory left, string memory right) internal pure returns(bool) {
        return keccak256(abi.encodePacked(left)) == keccak256(abi.encodePacked(right));
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
        string memory _ownerName;
        string memory _appName;

        _ownerName = ownerName.lower();
        _appName = appName.lower();

        
        // verify request
        {
            _validateExistingApp(did, _ownerName, _appName);

            bytes memory params = abi.encodePacked(did, ownerName, appName);
            params = abi.encodePacked(params, item.key, item.value);
            verifyRequest(did, params, requestSignature, requestProof);
        }

        AppMetaDataItem[] storage itemList = _didAppMetaData[did][_appName];
        uint len = itemList.length;
        bool isExistingItem;
        for (uint i; i < len;) {
            if (_isSameString(itemList[i].key, item.key)) {
                isExistingItem = true;
                itemList[i].value = item.value;
                break;
            }
            unchecked {
                ++i;
            }
        }
        if (!isExistingItem) {
            itemList.push(item);
        }

        emit UpdateApp(did, _ownerName, _appName, item);
    }

    /**
     * @dev See {INameRegistryV2}
     */
    function getApp(string calldata ownerName, string calldata appName) external view virtual override returns(address, AppMetaDataItem[] memory) {
        string memory _ownerName;
        string memory _appName;
        _ownerName = ownerName.lower();
        _appName = appName.lower();


        if (!_ownerNameInfo[_ownerName].registered) {
            revert InvalidOwnerName();
        }

        address did;
        did = _ownerNameInfo[_ownerName].DID;

        if (!_didApps[did].contains(_appName)) {
            revert InvalidAppName();
        }

        return (did, _didAppMetaData[did][_appName]);
    }


    /**
     * @dev See {INameRegistryV2}
     *      Once token address is set, it will never be set as zero address
     */
    function setTokenAddress(IERC20Upgradeable tokenAddr) external virtual payable override onlyOwner {
        assembly {
            if iszero(tokenAddr) {
                let ptr := mload(0x40)
                mstore(ptr, 0xaa7feadc00000000000000000000000000000000000000000000000000000000)
                revert(ptr, 0x4) //revert InvalidValue()
            }
        }

        if (address(vdaToken) == address(tokenAddr)) {
            revert InvalidValue();
        }

        vdaToken = tokenAddr;

        emit SetTokenAddress(address(tokenAddr));
    }

    /**
     * @dev See {INameRegistryV2}
     */
    function getTokenAddress() external view virtual override returns(address) {
        return address(vdaToken);
    }

    /**
     * @dev See {INameRegistryV2}
     *      Once fee is set, it will never be updated as 0
     */
    function updateAppRegisterFee(uint feeAmount) external virtual payable override onlyOwner {
        if (feeAmount == appRegisterFee || feeAmount == 0) {
            revert InvalidValue();
        }

        uint orgFee = appRegisterFee;
        appRegisterFee = feeAmount;

        emit UpdateAppRegisterFee(orgFee, appRegisterFee);
    }

    /**
     * @dev See {INameRegistryV2}
     */
    function getAppRegisterFee() external view virtual override returns(uint) {
        return appRegisterFee;
    }

    /**
     * @dev See {INameRegistryV2}
     */
    function setAppRegisterEnabled(bool isEnabled) external virtual payable override onlyOwner {
        if (_isAppRegisterEnabled == isEnabled) {
            revert InvalidValue();
        }

        if (isEnabled) {
            address tokenAddr =  address(vdaToken);
            assembly {
                if iszero(tokenAddr) {
                    let ptr := mload(0x40)
                    mstore(ptr, 0x898921d600000000000000000000000000000000000000000000000000000000)
                    revert(ptr, 0x4) //revert TokenAddressNotSet()
                }
            }
        }

        if (appRegisterFee == 0) {
            revert AppRegisterFeeNotSet();
        }

        _isAppRegisterEnabled = isEnabled;

        emit AppRegisterEnabled(_isAppRegisterEnabled);
    }

    /**
     * @dev See {INameRegistryV2}
     */
    function isAppRegisterEnabled() external view virtual override returns(bool) {
        return _isAppRegisterEnabled;
    }

    /**
     * @dev See {INameRegistryV2}
     */
    function getVersion() external pure virtual override returns(string memory) {
        return "2.0";
    }
}