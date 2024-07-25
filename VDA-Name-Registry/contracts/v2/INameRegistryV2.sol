//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface INameRegistryV2 {
    /**
     * @notice Struct for App meta data
     * @param key Key of item. Ex : "domain"
     * @param value Value of item. Ex: "verida.network"
     */
    struct AppMetaDataItem {
        string key;
        string value;
    }

    /**
     * @notice Emitted when a app is registered
     * @param did DID address
     * @param ownerName Owner name
     * @param appName App name
     * @param metadata Array of key/value pairs
     */
    event RegisterApp(
        address did,
        string ownerName,
        string appName,
        AppMetaDataItem[] metadata
    );

    /**
     * @notice Emitted when an App is de-registered
     * @param did DID address
     * @param ownerName Owner name
     * @param appName App name
     */
    event DeregisterApp(
        address did,
        string ownerName,
        string appName
    );

    /**
     * @notice Emitted when a meta data item of an App is updated
     * @param did DID address
     * @param ownerName Owner's name
     * @param appName App name
     * @param item Meta data item updated
     */
    event UpdateApp(
        address did, 
        string ownerName,
        string appName,
        AppMetaDataItem item
    );

    /**
     * @notice Emitted when the app registering feature enabled/disabled
     * @param enabled true if enabled.
     */
    event AppRegisterEnabled(bool enabled);

    /**
     * @notice Emitted when the token address set
     * @param tokenAddr Token address set
     */
    event SetTokenAddress(address tokenAddr);

    /**
     * @notice Emitted when the app registering fee is updated
     * @param from Original fee
     * @param to New fee
     */
    event UpdateAppRegisterFee(uint from, uint to);

    /**
     * @notice Register an app
     * @dev Need to deposit VDA token as fee. Fee is definec by Verida - Contract owner
     *      metadata should contain an item that the key is "domain".
     * @param did DID address
     * @param ownerName Owner's name. Only alphanumeric characters including spaces
     * @param appName App name. Only alphanumeric characters including space
     * @param metadata Array of key/value pairs
     * @param requestSignature The request parameters signed by the `didAddress` private key
     * @param requestProof Used to verify request
     */
    function registerApp(
        address did,
        string calldata ownerName,
        string calldata appName,
        AppMetaDataItem[] calldata metadata,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external;

    /**
     * @notice Deregister an app
     * @param did DID address
     * @param ownerName Owner's name
     * @param appName App name
     * @param requestSignature The request parameters signed by the `didAddress` private key
     * @param requestProof Used to verify request
     */
    function deregisterApp(
        address did, 
        string calldata ownerName, 
        string calldata appName,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external;

    /**
     * @notice Update the meta data item
     * @param did DID address
     * @param ownerName Owner's name
     * @param appName App name
     * @param item Meta data item to be updated
     * @param requestSignature The request parameters signed by the `didAddress` private key
     * @param requestProof Used to verify request
     */
    function updateApp(
        address did, 
        string calldata ownerName,
        string calldata appName,
        AppMetaDataItem calldata item,
        bytes calldata requestSignature,
        bytes calldata requestProof
    ) external;

    /**
     * @notice Get an app with given owner & app names
     * @param ownerName Owner's name
     * @param appName App name
     * @return address DID
     * @return AppMetaDataItem[] Array of meta data items
     */
    function getApp(string calldata ownerName, string calldata appName) external view returns(address, AppMetaDataItem[] memory);


    /**
     * @notice Set the Verida Token address
     * @dev Only the contract owner is allowed to call this function.
            This function is required because the original `NameRegistry` contract has no Token address
     * @param tokenAddr Address of Verida Token
     */
    function setTokenAddress(IERC20Upgradeable tokenAddr) external payable;

    /**
     * @notice Get the Verida token address
     * @return address Verida token address
     */
    function getTokenAddress() external view returns(address);

    /**
     * @notice Update fee for registering an app
     * @dev Only the contract owner is allowed
     * @param feeAmount Amount of VDA token
     */
    function updateAppRegisterFee(uint feeAmount) external payable;

    /**
     * @notice Return the fee for registering an app
     * @return uint Amount of tokens for fee
     */
    function getAppRegisterFee() external view returns(uint);

    /**
     * @notice Enable/disable the app registering feature
     * @dev Only the contract owner is allowe.
            The contract owner should enable the app registering feature after fee set.
     * @param isEnabled true if enabling, otherwise false
     */
    function setAppRegisterEnabled(bool isEnabled) external payable;

    /**
     * @notice Return whether App registering is enabled
     * @return bool true if enabled.
     */
    function isAppRegisterEnabled() external view returns(bool);

    /**
     * @notice Returns the contract version
     * @return string Contract version
     */
    function getVersion() external pure returns(string memory);

}