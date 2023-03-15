//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

library VeridaDataVerificationLib {
  function getSignerAddress(
    bytes memory _unsignedData,
    bytes calldata _signature
  ) internal pure returns (address) {
    bytes32 unsignedDataHash = keccak256(_unsignedData);
    return ECDSAUpgradeable.recover(unsignedDataHash, _signature);
  }

  function validateSignature(
    bytes memory _unsignedData,
    bytes calldata _signature,
    address _signerAddress
  ) internal pure returns (bool) {
    address signerAddress = getSignerAddress(_unsignedData, _signature);
    return signerAddress == _signerAddress && signerAddress != address(0);
  }
}