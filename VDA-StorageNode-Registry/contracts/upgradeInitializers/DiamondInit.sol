// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* Contract used to initialize state variables during deployment or upgrade
/******************************************************************************/
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibStorageNode } from "../libraries/LibStorageNode.sol";
import { IDiamondLoupe } from "../interfaces/IDiamondLoupe.sol";
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";
import { IERC173 } from "../interfaces/IERC173.sol";
import { IERC165 } from "../interfaces/IERC165.sol";
// import "hardhat/console.sol";

// It is expected that this contract is customized if you want to deploy your diamond
// with data from a deployment script. Use the init function to initialize state variables
// of your diamond. Add parameters to the init funciton if you need to.

// Adding parameters to the `init` or other functions you add here can make a single deployed
// DiamondInit contract reusable accross upgrades, and can be used for multiple diamonds.

contract DiamondInit {    

    // You can add parameters to this function in order to pass in 
    // data to set your own state variables
    function init(address tokenAddress) external {
        // adding ERC165 data
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[type(IERC173).interfaceId] = true;

        // Initialize StorageNode data
        LibStorageNode.NodeStorage storage ss = LibStorageNode.nodeStorage();
        ss.vdaTokenAddress = tokenAddress;
        ss.STAKE_PER_SLOT = 3 * (10 ** ERC20(tokenAddress).decimals());
        ss.MIN_SLOTS = 20000;
        ss.MAX_SLOTS = 20000;

        ss.NODE_ISSUE_FEE = 5 * (10 ** ERC20(tokenAddress).decimals());
        ss.SAME_NODE_LOG_DURATION = 1 hours;
        ss.LOG_LIMIT_PER_DAY = 4;
        ss.isWithdrawalEnabled = true;

        LibStorageNode.addReasonCode(10, "Poor performance");
        LibStorageNode.addReasonCode(20, "Unavailable > 10 minutes");
        LibStorageNode.addReasonCode(21, "Unavailable > 30 minutes");
        LibStorageNode.addReasonCode(22, "Unavailable > 1 hour");
        LibStorageNode.addReasonCode(23, "Unavailable > 3 hour");
        LibStorageNode.addReasonCode(24, "Unavailable > 24 hours");
        LibStorageNode.addReasonCode(30, "Data incomplete");
        LibStorageNode.addReasonCode(31, "Data corrupt");
    }
}
