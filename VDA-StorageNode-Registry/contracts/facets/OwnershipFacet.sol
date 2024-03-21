// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { IERC173 } from "../interfaces/IERC173.sol";

contract OwnershipFacet is IERC173 {
    error InvalidAddress();
    error NoPendingTrnasferOwnership();

    function transferOwnership(address _newOwner) external override {
        if (_newOwner == LibDiamond.contractOwner() || _newOwner == LibDiamond.pendingOwner()) {
            revert InvalidAddress();
        }

        assembly {
            if iszero(_newOwner) {
                let ptr := mload(0x40)
                mstore(ptr, 0xe6c4247b00000000000000000000000000000000000000000000000000000000)
                revert(ptr, 0x4) //revert InvalidAddress()
            }
        }

        LibDiamond.enforceIsContractOwner();
        LibDiamond.transferOwnership(_newOwner);
    }

    function cancelTransferOwnership() external {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.cancelTransferOwnership();
    }

    function acceptOwnership() external {
        LibDiamond.acceptOwnership();
    }

    function pendingOwner() external view returns(address pendingOwner_) {
        pendingOwner_ = LibDiamond.pendingOwner();
    }

    function owner() external override view returns (address owner_) {
        owner_ = LibDiamond.contractOwner();
    }
}
