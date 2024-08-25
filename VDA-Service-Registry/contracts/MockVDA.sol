// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockVDA is ERC20{
    constructor() ERC20("Verida", "VDA") {}

    function mintTokens(address _to, uint256 _amount) public {
        _mint(_to, _amount);
    }

    function getBalance(address _account) public view returns(uint256) {
        return (balanceOf(_account));
    }
}