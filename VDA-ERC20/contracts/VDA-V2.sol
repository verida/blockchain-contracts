//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";

import "./IVDA.sol";

import "hardhat/console.sol";
import "./ITestUpgradeable.sol";

// contract VeridaTokenV2 is ERC20PausableUpgradeable, OwnableUpgradeable, 
//     IVeridaToken, AccessControlEnumerableUpgradeable, ITestUpgradeable {
    
//     bytes32 internal constant MINT_ROLE = keccak256('MintRole');

//     // LockInfo List
//     // mapping(address => LockInfo) lockInfoList;
//     /** @dev LockType of each user. General users are not locked and type is 0 */
//     mapping(address => LockType) public holderLockType;
//     /** @dev lock total amount for each other */
//     mapping(address => uint256) public lockTotal;
//     /** @dev LockInfo of each LockType */
//     mapping(uint256 => LockInfo) public lockInfo;

//     /** @dev Release start time */
//     uint256 releaseStart;

//     /**
//      * @dev LockInformation for each lock type. There is 4 'LockInfo's.
//      */
//     struct LockInfo {
//         uint256 releaseDuration;
//         uint256 releaseInterval;        
//     }

//     enum LockType {
//         None, Seed, Founder, Team, Advisor
//     }
    
//     /**
//      * @dev see {IVeridaToken-addMinter}
//      */
//     function addMinter(address to) external onlyOwner override {
//         require(!hasRole(MINT_ROLE, to), 'Already granted');
//         require(to != address(0), 'Invalid zero address');

//         grantRole(MINT_ROLE, to);

//         emit AddMinter(to);
//     }

//     /**
//      * @dev see {IVeridaToken-revokeMinter}
//      */
//     function revokeMinter(address to) external onlyOwner override {
//         require(hasRole(MINT_ROLE, to), 'No minter');

//         revokeRole(MINT_ROLE, to);

//         emit RevokeMinter(to);
//     }

//     /**
//      * @dev see {IVeridaToken-getMinterCount}
//      */
//     function getMinterCount() external view override returns(uint256){
//         return getRoleMemberCount(MINT_ROLE);
//     }

//     /**
//      * @dev see {IVeridaToken-getMinterList}
//      */
//     function getMinterList() external view override returns(address[] memory) {
//         uint256 count = getRoleMemberCount(MINT_ROLE);
//         address[] memory minterList = new address[](count);
//         for (uint256 i = 0; i < count; i++) {
//             minterList[i] = getRoleMember(MINT_ROLE, i);
//         }
//         return minterList;
//     }

//     /**
//      * @dev see {ITestUpgradeable}
//      */
//     function getVersion() external pure override returns(string memory){
//         return "2.0";
//     }
    
// }