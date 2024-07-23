//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface INameRegistry {
    /**
     * @notice Emitted when a name is registered
     * @param name Registred name
     * @param DID DID that registered the `name`
     */
    event Register(string indexed name, address indexed DID);

    /**
     * @notice Emitted when a name is unregistered
     * @param name Unregistered name
     * @param DID DID that unregistered the `name`
     */
    event Unregister(string indexed name, address indexed DID);

    /**
     * @notice Emitted when the contract owner added a suffix
     * @param suffix Added suffix
     */
    event AddSuffix(string indexed suffix);

    /**
     * @notice Emitted when the contract owner update the maximum count of names per DID
     * @param from Previous value
     * @param to Updated value
     */
    event UpdateMaxNamesPerDID(uint from, uint to);

    /**
     * @notice Return the nonce of given DID
     * @param did DID address
     * @return uint nonce of the DID
     */
    function nonce(address did) external view returns(uint);

    /**
     * @notice Register a name
     * @dev Only the names with valid suffix, that is registered in the contract, are available
     * @param name Name to be registered
     * @param did DID address
     * @param signature Signature of parameters signed by the `did`'s private key

     */
    function register(string calldata name, address did, bytes calldata signature) external;

    /**
     * @notice Unregister a name
     * @param name Name to be unregistered. Should be registered before.
     * @param did DID address.
     * @param signature Signature of parameters signed by the `did`'s private key
     */
    function unregister(string calldata name, address did, bytes calldata signature) external;

    /**
     * @notice Find the DID of the given name
     * @dev If the `name` is not registered before, transaction will be reverted
     * @param name Name registered to a DID
     * @return address DID address of the given name
     */
    function findDID(string memory name) external view returns(address);

    /**
     * @notice Get the list of registered names
     * @dev If the `did` has no names registered before, the transaction will be reverted
     * @param did DID address
     * @return string[] List of names
     */
    function getUserNameList(address did) external view returns(string[] memory);

    /**
     * @notice Add a suffix
     * @dev Only the contract owner can add/remove a suffix.
     * @param suffix - Suffix to be added
     */
    function addSuffix(string memory suffix) external payable;

    /**
     * @notice Check the given suffix is valid
     * @param suffix Suffix to be checked
     * @return bool true if valid
     */
    function isValidSuffix(string calldata suffix) external view returns(bool);

    /**
     * @notice Return array of valid suffixes
     * @return string[] List of suffixes
     */
    function getSuffixList() external view returns(string[] memory);

    /**
     * @notice Update maximum number of names per DID
     * @param count Value to be updated
     */
    function updateMaxNamesPerDID(uint count) external payable;
}