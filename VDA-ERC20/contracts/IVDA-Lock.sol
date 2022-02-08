//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IVeridaTokenLock {
    /**
     * @dev Add new lock type
     */
    function addLockType(uint256 lockDuration, uint256 releaseInterval, uint256 releaseDelay, bool isValidFromTGE) external;

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
     * @dev Get remaining locked amountof caller
     */
    function lockedAmount() external view returns(uint256);

    /**
     * @dev calculate available token amount
     */
    function claimableAmount() external view returns(uint256);

    /**
     * @dev release available tokens to caller
     */
    function claim() external;

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
        uint256 released;
    }

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

    /**
     * @dev Emitted when user claimed
     */
    event Claim(address indexed to, uint256 amount);

}