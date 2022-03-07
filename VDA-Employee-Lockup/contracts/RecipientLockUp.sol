//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./IRecipientLockUp.sol";
import "hardhat/console.sol";

contract RecipientLockUp is OwnableUpgradeable, IRecipientLockUp {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /** @dev Lock token address */
    IERC20Upgradeable public token;
    
    /** @dev Total locked amount */
    uint256 public totalLockedAmount;

    /** @dev number of lock types registered */
    uint8 public lockTypeCount;

    /** 
     * @dev LockTypeInfo of each LockType
     * lockType => LockTypeInfo
     */
    mapping(uint8 => LockTypeInfo) public lockTypeInfo;

    /**
     * @dev LockInfo of Recipient
     */
    mapping(address => RecipientInfo) public recipientInfo;

    /**
     * @dev Emitted when owner withdraw tokens.
     */
    event WtihdrawTokens(address to, uint256 amount);

    function initialize(address tokenAddress) public initializer {
        __Ownable_init();

        token = IERC20Upgradeable(tokenAddress);

        _initLockupType();
    }

    /**
     * @notice Initialize lock-up types.
     */
    function _initLockupType() internal {
        // Default Recipient info
        _addLockType(
            4 * 365 days,
            30 days,
            365 days
        );
    }

    /**
     * @dev See {IRecipientLockUp}
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
     * @dev Withdraw unlocked tokens
     * Only owner can call this
     */
    function withdrawUnlockedTokens() public onlyOwner {
        withdrawUnlockedTokensTo(owner());
    }

    /**
     * @dev Withdraw unlocked tokens to address.
     * Only owner can call this
     */
    function withdrawUnlockedTokensTo(address to) public onlyOwner {
        uint256 unlockedAmount = token.balanceOf(address(this)) - totalLockedAmount;
        require(unlockedAmount > 0, 'No tokens');

        token.safeTransfer(to, unlockedAmount);

        emit WtihdrawTokens(to, unlockedAmount);
    }

    /**
     * @dev See {IRecipientLockUp}
     */
    function addRecipient(address to, uint256 _lockAmount, uint256 _lockStart) external onlyOwner override {
        _addRecipientWithLockType(to, _lockAmount, _lockStart, 1);
    }

    /**
     * @dev See {IRecipientLockUp}
     */
    function addRecipientWithLockType(address to, uint256 _lockAmount, uint256 _lockStart, uint8 _lockType) external onlyOwner override {
        _addRecipientWithLockType(to, _lockAmount, _lockStart, _lockType);
    }

    /**
     * @dev private function to add recipient
     */
    function _addRecipientWithLockType(address to, uint256 _lockAmount, uint256 _lockStart, uint8 _lockType) private {
        require(to != address(0x0), "Invalid zero address");
        require(_lockType > 0 && _lockType <= lockTypeCount, "Invalid lock type");

        require(_lockAmount > 0, "Invalid lock amount");

        require(_lockStart >= block.timestamp, "Invalid lock start time");

        RecipientInfo storage userInfo = recipientInfo[to];
        if (userInfo.lockType != 0) {
            totalLockedAmount -= userInfo.lockAmount;
        }

        uint256 tokenAmount = token.balanceOf(address(this));
        require((totalLockedAmount + _lockAmount) <= tokenAmount, "Insufficient token amount");
        totalLockedAmount += _lockAmount;

        userInfo.lockType = _lockType;
        userInfo.lockAmount = _lockAmount;
        userInfo.lockStart = _lockStart;
        userInfo.released = 0;

        emit AddRecipient(to, _lockType, _lockAmount);
    }

    /** 
     * @dev see {IRecipientLockUp}
     */
    function removeRecipient(address to) external onlyOwner override {
        RecipientInfo storage userInfo = recipientInfo[to];
        require(userInfo.lockType > 0 && userInfo.lockType <= lockTypeCount, "Not an recipient");

        totalLockedAmount -= userInfo.lockAmount;

        delete recipientInfo[to];

        emit RemoveRecipient(to);
    }

    /**
     * @dev See {IRecipientLockUp}
     */
    function lockedAmount() external view override returns(uint256) {
        RecipientInfo storage userInfo = recipientInfo[msg.sender];
        return userInfo.lockAmount - userInfo.released;
    }

    /**
     * @dev See {IRecipientLockUp}
     */
    function claimableAmount() external view override returns(uint256) {
        return _claimableAmount(msg.sender);
    }

    function _claimableAmount(address to) private view returns(uint256) {
        RecipientInfo storage userInfo = recipientInfo[to];
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
     * @dev See {IRecipientLockUp}
     */
    function claim() external override {
        uint256 amount = _claimableAmount(msg.sender);

        if (amount > 0) {
            RecipientInfo storage userInfo = recipientInfo[msg.sender];

            userInfo.released += amount;
            IERC20Upgradeable((address(token))).safeTransfer(msg.sender, amount);

            totalLockedAmount -= amount;

            emit Claim(msg.sender, amount);
        }
    }






}