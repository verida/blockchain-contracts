// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IStorageNode {

  event TokenDeposited(address indexed didAddress, address from, uint amount);

  /**
    * @notice Depoist verida tokens from specified address(`from` parameter) to the didAddress
    * @dev Work for only the registered DIDs
    * @param didAddress DID address
    * @param from Smart contract or EOA address that provide the deposited token
    * @param tokenAmount Depositing amount of Verida token
    */
  function depositTokenFromProvider(address didAddress, address from, uint tokenAmount) external;
  
}