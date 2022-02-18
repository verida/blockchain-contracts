//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./IEmployeeLockUp.sol";
import "./IVDA.sol";

contract EmployeeLockUp is OwnableUpgradeable, IEmployeeLockUp {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /** @dev Lock token address */
    IVeridaToken public token;

    /** @dev number of lock types registered */
    uint8 public lockTypeCount;

    /** 
     * @dev LockTypeInfo of each LockType
     * lockType => LockTypeInfo
     */
    mapping(uint8 => LockTypeInfo) public lockTypeInfo;

    /**
     * @dev LockInfo of employee
     */
    mapping(address => EmployeeInfo) public employeeInfo;

    function initialize(address tokenAddress) public initializer {
        __Ownable_init();

        token = IVeridaToken(tokenAddress);

        _initLockupType();
    }

    /**
     * @notice Initialize lock-up types.
     */
    function _initLockupType() internal {
        // Default Employee info
        _addLockType(
            4 * 365 days,
            30 days,
            365 days
        );
    }

    /**
     * @dev See {IEmployeeLockUp}
     */
    function addLockType(uint256 lockDuration, uint256 releaseInterval, uint256 releaseDelay) external onlyOwner override {
        require(lockDuration > 0, "Invalid lock duration");
        require(releaseInterval > 0, "Invalid release interval");
        _addLockType(lockDuration, releaseInterval, releaseDelay);
    }

    /**
     * @dev private function to add lockType
     */
    function _addLockType(uint256 lockDuration, uint256 releaseInterval, uint256 releaseDelay) private {
        lockTypeCount++;
        lockTypeInfo[lockTypeCount] = LockTypeInfo(
            lockDuration,
            releaseInterval,
            releaseDelay
        );

        emit AddLockType(lockTypeCount, lockDuration, releaseInterval, releaseDelay);
    }

    /**
     * @dev See {IEmployeeLockUp}
     */
    function addEmployee(address to, uint256 _lockAmount, uint256 _lockStart) external onlyOwner override {
        _addEmployeeWithLockType(to, _lockAmount, _lockStart, 1);
    }

    /**
     * @dev See {IEmployeeLockUp}
     */
    function addEmployeeWithLockType(address to, uint256 _lockAmount, uint256 _lockStart, uint8 _lockType) external onlyOwner override {
        _addEmployeeWithLockType(to, _lockAmount, _lockStart, _lockType);
    }

    /**
     * @dev private function to add employee
     */
    function _addEmployeeWithLockType(address to, uint256 _lockAmount, uint256 _lockStart, uint8 _lockType) private {
        require(to != address(0x0), "Invalid zero address");
        require(_lockType > 0 && _lockType <= lockTypeCount, "Invalid lock type");
        require(_lockAmount > 0, "Invalid lock amount");

        require(_lockStart >= block.timestamp, "Invalid lock start time");

        EmployeeInfo storage userInfo = employeeInfo[to];
        if (userInfo.lockType != 0) {
            token.burn(address(this), userInfo.lockAmount);
        }

        token.mint(address(this), _lockAmount);

        userInfo.lockType = _lockType;
        userInfo.lockAmount = _lockAmount;
        userInfo.lockStart = _lockStart;
        userInfo.released = 0;

        emit AddEmployee(to, _lockType, _lockAmount);
    }

    /** 
     * @dev see {IEmployeeLockUp}
     */
    function removeEmployee(address to) external onlyOwner override {
        EmployeeInfo storage userInfo = employeeInfo[to];
        require(userInfo.lockType > 0 && userInfo.lockType <= lockTypeCount, "Not an employee");

        token.burn(address(this), employeeInfo[to].lockAmount - employeeInfo[to].released);
        delete employeeInfo[to];

        emit RemoveEmployee(to);
    }

    /**
     * @dev See {IEmployeeLockUp}
     */
    function lockedAmount() external view override returns(uint256) {
        EmployeeInfo storage userInfo = employeeInfo[msg.sender];
        return userInfo.lockAmount - userInfo.released;
    }

    /**
     * @dev See {IEmployeeLockUp}
     */
    function claimableAmount() external view override returns(uint256) {
        return _claimableAmount(msg.sender);
    }

    function _claimableAmount(address to) private view returns(uint256) {
        EmployeeInfo storage userInfo = employeeInfo[to];
        LockTypeInfo storage lockInfo = lockTypeInfo[userInfo.lockType];

        // Before first release
        if ( userInfo.lockType == 0 || block.timestamp < (userInfo.lockStart + lockInfo.releaseInterval + lockInfo.releaseDelay))
            return 0;
                
        // After lock duration end.
        if ( block.timestamp >= (userInfo.lockStart + lockInfo.lockDuration + lockInfo.releaseDelay)) {
            return (userInfo.lockAmount - userInfo.released);
        }
    
        uint256 releasePerInterval = userInfo.lockAmount * lockInfo.releaseInterval / lockInfo.lockDuration;
        uint256 intervalCount = (block.timestamp - userInfo.lockStart - lockInfo.releaseDelay) / lockInfo.releaseInterval;

        return (releasePerInterval * intervalCount) - userInfo.released;
    }

    /**
     * @dev See {IEmployeeLockUp}
     */
    function claim() external override {
        uint256 amount = _claimableAmount(msg.sender);

        if (amount > 0) {
            EmployeeInfo storage userInfo = employeeInfo[msg.sender];

            userInfo.released += amount;
            IERC20Upgradeable((address(token))).safeTransfer(msg.sender, amount);

            emit Claim(msg.sender, amount);
        }
    }






}