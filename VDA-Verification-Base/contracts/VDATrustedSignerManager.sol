//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

error RegisteredSigner();
error UnregisteredSigner();

abstract contract VDATrustedSignerManager is OwnableUpgradeable {

    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    
    /** @notice Trusted signer addresses */
    EnumerableSetUpgradeable.AddressSet internal _trustedSigners;

    /**
     * @notice Emitted when the contract owner adds a trusted signer
     * @param signerAddress Address of signer
     */
    event AddTrustedSigner(address signerAddress);

    /**
     * @notice Emitted when the contract owner removes a trusted signer
     * @param signerAddress Address of signer
     */
    event RemoveTrustedSigner(address signerAddress);
    
    /**
     * @notice Initializer for deploying the contract
     * @dev This contract can't be deployed directly. Should be used as a parent class only
     */
    function __VDATrustedSignerManager_init() internal onlyInitializing {
        __Ownable_init();
        __VDATrustedSignerManager_init_unchained();
    }

    /**
     * @notice Initializer for deploying the contract
     * @dev Initialze the necessary stuffs that are unique to this contract
     */
    function __VDATrustedSignerManager_init_unchained() internal onlyInitializing {
    }

    /**
     * @notice Add a trusted signer
     * @dev Only the contract owner can add
     * @param didAddress Trusted signer address
     */
    function addTrustedSigner(address didAddress) external virtual payable onlyOwner {
        if (_trustedSigners.contains(didAddress)) {
            revert RegisteredSigner();
        }
        _trustedSigners.add(didAddress);
        emit AddTrustedSigner(didAddress);
    }

    /**
     * @notice Remove a trusted signer
     * @dev Only the contract owner can remove
     * @param didAddress Trusted signer address
     */
    function removeTrustedSigner(address didAddress) external virtual payable onlyOwner {
        if (!_trustedSigners.contains(didAddress)) {
            revert UnregisteredSigner();
        }
        _trustedSigners.remove(didAddress);
        emit RemoveTrustedSigner(didAddress);
    }

    /**
     * @notice Check whether address is a trusted signer
     * @param didAddress DID address to be checked
     * @return bool true if registered, otherwise false
     */
    function isTrustedSigner(address didAddress) external view virtual onlyOwner returns(bool) {
        return _trustedSigners.contains(didAddress);
    }
}