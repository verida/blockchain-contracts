// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./IVDA.sol";
import "./IVDA-Lock.sol";

contract VDALock is OwnableUpgradeable, IVeridaTokenLock, ReentrancyGuardUpgradeable {
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
     * @dev LockInfo of user
     */
    mapping(address => UserLockInfo) public userLockInfo; 

    function initialize(address tokenAddress) external initializer {
        __Ownable_init();
        __ReentrancyGuard_init();

        token = IVeridaToken(tokenAddress);

        _initLockupType();
    }

    /**
     * @notice Initialize lock-up types.
     */
    function _initLockupType() internal {

        // Investors
        _addLockType(
            2 * 365 days,
            30 days,
            0,
            true
        );

        // Founders, Mozzler grant
        _addLockType(
            4 * 365 days,
            30 days,
            0,
            true
        );

        // Team members
        _addLockType(
            4 * 365 days,
            30 days,
            365 days,
            false
        );

        // Advisors
        _addLockType(
            2 * 365 days,
            30 days,
            0,
            true
        );

        // Community
        _addLockType(
            5 * 365 days,
            30 days,
            0,
            true
        );
    }

    /**
     * @dev See {IVDA}
     */
    function addLockType(uint256 lockDuration, uint256 releaseInterval, uint256 releaseDelay, bool isValidFromTGE) external onlyOwner override {
        require(lockDuration > 0, "Invalid lock duration");
        require(releaseInterval > 0, "Invalid release interval");
        _addLockType(lockDuration, releaseInterval, releaseDelay, isValidFromTGE);
    }

    function _addLockType(uint256 lockDuration, uint256 releaseInterval, uint256 releaseDelay, bool isValidFromTGE) private {
        lockTypeCount++;
        lockTypeInfo[lockTypeCount] = LockTypeInfo(
            lockDuration,
            releaseInterval,
            releaseDelay,
            isValidFromTGE
        );

        emit AddLockType(lockTypeCount, lockDuration, releaseInterval, releaseDelay, isValidFromTGE);
    }

    /**
     * @dev See {IVDA}
     */
    function addLockHolder(address to, uint8 _lockType, uint256 _lockAmount, uint256 _lockStart) external onlyOwner nonReentrant override {
        require(to != address(0x0), 'Invalid zero address');
        require(_lockType > 0 && _lockType <= lockTypeCount, "Invalid lock type");
        require(_lockAmount > 0, "Invalid lock amount");

        uint256 tokenPublishTime = token.getTokenPublishTime();
        if (lockTypeInfo[_lockType].isValidFromTGE) {
            require(block.timestamp < tokenPublishTime, "Token published");
        } else {
            require(_lockStart >= block.timestamp, "Invalid lock start time");
        }

        UserLockInfo storage userInfo = userLockInfo[to];
        if (userInfo.lockType != 0) {
            token.burn(address(this), userInfo.lockAmount);
        }

        token.mint(address(this), _lockAmount);

        userInfo.lockType = _lockType;
        userInfo.lockAmount = _lockAmount;
        userInfo.lockStart = lockTypeInfo[_lockType].isValidFromTGE ? 
            ( tokenPublishTime ) :
            (_lockStart );
        userInfo.released = 0;

        emit AddLockHolder(to, _lockType, _lockAmount);
    }

    /** 
     * @dev see {IVDA}
     */
    function removeLockHolder(address to) external onlyOwner nonReentrant override {
        uint256 tokenPublishTime = token.getTokenPublishTime();

        UserLockInfo storage userInfo = userLockInfo[to];
        require(userInfo.lockType > 0 && userInfo.lockType <= lockTypeCount, "Not a lock holder");

        LockTypeInfo storage lockInfo = lockTypeInfo[userInfo.lockType];

        if (lockInfo.isValidFromTGE) {
            require(block.timestamp < tokenPublishTime, "Token published");
        }

        token.burn(address(this), userLockInfo[to].lockAmount - userLockInfo[to].released);
        delete userLockInfo[to];

        emit RemoveLockHolder(to);
    }

    /**
     * @dev See {IVDA-Lock}
     */
    function lockedAmount() external view override returns(uint256) {
        UserLockInfo storage userInfo = userLockInfo[msg.sender];
        return userInfo.lockAmount - userInfo.released;
    }

    /**
     * @dev See {IVDA-Lock}
     */
    function claimableAmount() external view override returns(uint256) {
        return _claimableAmount(msg.sender);
    }

    function _claimableAmount(address to) private view returns(uint256) {
        UserLockInfo storage userInfo = userLockInfo[to];
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
     * @dev See {IVDA-Lock}
     */
    function claim() external nonReentrant override {
        uint256 amount = _claimableAmount(msg.sender);

        if (amount > 0) {
            UserLockInfo storage userInfo = userLockInfo[msg.sender];

            userInfo.released += amount;
            IERC20Upgradeable((address(token))).safeTransfer(msg.sender, amount);

            emit Claim(msg.sender, amount);
        }
    }
}