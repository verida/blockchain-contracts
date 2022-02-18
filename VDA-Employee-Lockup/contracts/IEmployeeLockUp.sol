//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEmployeeLockUp {
    /**
     * @dev Add new lock type
     * @param lockDuration duration of lock
     * @param releaseInterval interval duration to release part of the locked-up amount
     * @param releaseDelay user can claim released amount after this delay on each release
     */
    function addLockType(uint256 lockDuration, uint256 releaseInterval, uint256 releaseDelay) external;

    /** @dev Add Employee with default lock type. Mint locked amount.
     * @param to address of lock holder
     * @param _lockAmount Initial locked-up amount
     * @param _lockStart start time of lock-up. This is only for lock types that is not validated from TGE
     */
    function addEmployee(address to, uint256 _lockAmount, uint256 _lockStart) external;

    /** @dev Add Employee. Mint locked amount.
     * This function can be removed in later versions once all locktypes are released.
     * @param to address of lock holder
     * @param _lockAmount Initial locked-up amount
     * @param _lockStart start time of lock-up. This is only for lock types that is not validated from TGE
     * @param _lockType can be one of 1 ~ lockTypeCount. 0 means general user not lock-up holder.
     */
    function addEmployeeWithLockType(address to, uint256 _lockAmount, uint256 _lockStart,  uint8 _lockType) external;

    /** 
     * @dev Remove Employee. Burn locked amount. 
     * This function can be removed in later versions once all locktypes are released.
     */
    function removeEmployee(address to) external;

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
    }
    
    /**
     * @dev User Lock Info
     */
    struct EmployeeInfo {
        uint8 lockType;
        uint256 lockAmount;
        uint256 lockStart;
        uint256 released;
    }

    /**
     * @dev Emitted when new lock type added
     */
    event AddLockType(uint8 indexed lockTypeNo, uint256 lockDuration, uint256 releaseInterval, uint256 releaseDelay);

    /**
     * @dev Emitted when employee added
     */
    event AddEmployee(address indexed to, uint8 indexed lockType, uint256 lockAmount);

    /**
     * @dev Emitted when lock holder removed
     */
    event RemoveEmployee(address indexed to);

    /**
     * @dev Emitted when user claimed
     */
    event Claim(address indexed to, uint256 amount);
}