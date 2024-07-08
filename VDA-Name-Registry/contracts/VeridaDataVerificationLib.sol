//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

error NoSigners();
error InvalidSignature();

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
  ) internal pure returns (bool result) {
    address signerAddress = getSignerAddress(_unsignedData, _signature);
    result = signerAddress == _signerAddress;
    assembly {
      if iszero(signerAddress) {
        result := false
      }
    }
  }

  /**
    * Verify any data is signed by a particular array of DID addresses
    * @dev Copied from `VDAVerificationContract` to verify request
    * @param data Any type of raw data
    * @param signature Data signed by a Verida application context signing key
    * @param proof Signed proof that a Verida DID controls a Verida application context signing key
    * @param validSigners Array of did addresses that are valid signers of data
    */
  function verifyDataWithSigners(
      bytes memory data, 
      bytes memory signature,
      bytes memory proof,
      address[] memory validSigners
  ) internal pure {
    if (validSigners.length == 0) {
        revert NoSigners();
    }

    if (data.length == 0 || signature.length == 0 || proof.length == 0) {
        revert InvalidSignature();
    }

    bytes32 dataHash = keccak256(data);
    address contextSigner = ECDSAUpgradeable.recover(dataHash, signature);
    string memory strContextSigner = StringsUpgradeable.toHexString(uint256(uint160(contextSigner)));

    bool isVerified;
    uint index;

    while (index < validSigners.length && !isVerified) {
        address account = validSigners[index];

        string memory strAccount = StringsUpgradeable.toHexString(uint256(uint160(account)));
        bytes memory proofString = abi.encodePacked(
            strAccount,
            strContextSigner
        );
        bytes32 proofHash = keccak256(proofString);
        address didSigner = ECDSAUpgradeable.recover(proofHash, proof);

        if (didSigner == account) {
            isVerified = true;
            break;
        }
        unchecked { ++index; }
    }

    if (!isVerified) {
        revert InvalidSignature();
    }
  }
}