// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibVerification } from "../libraries/LibVerification.sol";

error RegisteredSigner();
error UnregisteredSigner();

contract VDAVerificationFacet {
  using EnumerableSet for EnumerableSet.AddressSet;
  
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
    * @notice Add a trusted signer
    * @param didAddress Trusted signer address
    */
  function addTrustedSigner(address didAddress) external virtual {
    LibDiamond.enforceIsContractOwner();
    LibVerification.DiamondStorage storage ds = LibVerification.diamondStorage();
    if (ds.trustedSigners.contains(didAddress)) {
        revert RegisteredSigner();
    }
    ds.trustedSigners.add(didAddress);
    emit AddTrustedSigner(didAddress);
  }

  /**
    * @notice Remove a trusted signer
    * @dev Only the contract owner can remove
    * @param didAddress Trusted signer address
    */
  function removeTrustedSigner(address didAddress) external virtual {
    LibDiamond.enforceIsContractOwner();
    LibVerification.DiamondStorage storage ds = LibVerification.diamondStorage();
    if (!ds.trustedSigners.contains(didAddress)) {
        revert UnregisteredSigner();
    }
    ds.trustedSigners.remove(didAddress);
    emit RemoveTrustedSigner(didAddress);
  }

  /**
    * @notice Check whether address is a trusted signer
    * @param didAddress DID address to be checked
    * @return bool true if registered, otherwise false
    */
  function isTrustedSigner(address didAddress) external view virtual returns(bool) {
    LibDiamond.enforceIsContractOwner();
    LibVerification.DiamondStorage storage ds = LibVerification.diamondStorage();
    return ds.trustedSigners.contains(didAddress);
  }  
}
