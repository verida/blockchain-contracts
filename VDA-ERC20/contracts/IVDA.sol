//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
     * @dev Add new lock type
     */
    function addLockType(uint256 lockDuration, uint256 releaseInterval, uint256 releaseDelay, bool isValidFromTGE) external;

    /**
     * @dev Return locked amount of caller.
     */
    function lockedAmount() external view returns(uint256);

    /** @dev Add LockHolders. Mint locked amount.
     * This function can be removed in later versions once all locktypes are released.
     * @param to address of lock holder
     * @param _lockType can be one of 1 ~ lockTypeCount. 0 means general user not lock-up holder.
     * @param _lockAmount Initial locked-up amount
     * @param _lockStart start time of lock-up. This is only for lock types that is not validated from TGE
     */
    function addLockHolder(address to, uint8 _lockType, uint256 _lockAmount, uint256 _lockStart) external; 

    /** 
     * @dev Remove LockHolder. Burn locked amount. 
     * This function can be removed in later versions once all locktypes are released.
     */
    function removeLockHolder(address to) external;

    /**
     * @dev LockType information for each lock type.
     */
    struct LockTypeInfo {
        uint256 lockDuration;
        uint256 releaseInterval;
        uint256 releaseDelay;
        bool isValidFromTGE;
    }
    
    /**
     * @dev User Lock Info
     */
    struct UserLockInfo {
        uint8 lockType;
        uint256 lockAmount;
        uint256 lockStart;
    }

    /**
     * @dev Emitted when MINT_ROLE is added to 'to' address
     */
    event AddMinter(address indexed to);

    /**
     * @dev Emitted when MINT_ROLE is revoked from 'to' address
     */
    event RevokeMinter(address indexed to);

    /**
     * @dev Emitted when new lock type added
     */
    event AddLockType(uint8 indexed lockTypeNo, uint256 lockDuration, uint256 releaseInterval, uint256 releaseDelay, bool isValidFromTGE);

    /**
     * @dev Emitted when lock holder added
     */
    event AddLockHolder(address indexed to, uint8 indexed lockType, uint256 lockAmount);

    /**
     * @dev Emitted when lock holder removed
     */
    event RemoveLockHolder(address indexed to);

    
}