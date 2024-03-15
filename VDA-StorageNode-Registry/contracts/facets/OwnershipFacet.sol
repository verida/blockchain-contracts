// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { IERC173 } from "../interfaces/IERC173.sol";

contract OwnershipFacet is IERC173 {
    error ZeroAddress();
    error NoPendingTrnasferOwnership();

    function transferOwnership(address _newOwner) external override {
        assembly {
            if iszero(_newOwner) {
                let ptr := mload(0x40)
                mstore(ptr, 0xd92e233d00000000000000000000000000000000000000000000000000000000)
                revert(ptr, 0x4) //revert ZeroAddress()
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
