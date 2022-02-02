//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITestUpgradeable {
    /**
     * @dev Get Version of current Token. Test purpose only.
     */
    function getVersion() external pure returns(string memory);
}