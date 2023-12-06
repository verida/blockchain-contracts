// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

library LibCommon {
    /**
     * @notice Status of storage node & data center
     */
    enum EnumStatus{
        removed,
        removing,
        active
    }
}
