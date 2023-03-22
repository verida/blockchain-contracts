//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/** @title Verida Token */
interface IVeridaToken {
    /**
     * @dev Allow token mint for 'to'.
     */
    function addMinter(address to) external;

    /**
     * @dev Revoke mint role from 'to'
     */
    function revokeMinter(address to) external;

    /**
     * @dev Get Minter count.
     */
    function getMinterCount() external view returns(uint256);

    /**
     * @dev Get Minter list.
     */
    function getMinterList() external view returns(address[] memory);

    /**
     * @dev Mint `amount` tokens to `to`.
     */
    function mint(address to, uint256 amount) external;

    /**
     * @dev Burn `amount` tokens from `to`.
     */
    function burn(uint256 amount) external;

    /**
     * @notice Enable token transfer
     * @dev Only the contract owner enables. Once enabled, not able to disable.
     */
    function enableTransfer() external;

    /**
     * @dev Emitted when MINT_ROLE is added to 'to' address
     */
    event AddMinter(address indexed to);

    /**
     * @dev Emitted when MINT_ROLE is revoked from 'to' address
     */
    event RevokeMinter(address indexed to);    
}