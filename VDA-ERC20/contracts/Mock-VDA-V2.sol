//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./VDA-V1.sol";

contract VeridaTokenV2 is VeridaToken {
    /**
     * @dev return current version of Verida Token
     */
    function getVersion() external virtual pure override returns(string memory){
        return "2.0";
    }
}