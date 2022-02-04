//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";

import "./IVDA.sol";
import "./ITestUpgradeable.sol";

// import "hardhat/console.sol";

contract VeridaToken is ERC20PausableUpgradeable, OwnableUpgradeable, 
    IVeridaToken, AccessControlEnumerableUpgradeable, ITestUpgradeable {

    string public constant TOKEN_NAME = "Verida";
    string public constant TOKEN_SYMBOL = "VDA";

    uint8 public constant DECIMAL = 18;
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * (10 ** DECIMAL);
    
    bytes32 internal constant MINT_ROLE = keccak256('MintRole');

    /** @dev Token publish time */
    uint256 public tokenPublishTime;

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
        
    /**
     * @dev LockTypeInformation for each lock type. There is 5 'LockTypeInfo's.
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

    modifier validMint(uint256 amount) {
        require((totalSupply() + amount) <= MAX_SUPPLY, "Max supply limit");
        _;
    }

    event AddLockHolder(address indexed to, uint8 indexed lockType, uint256 lockAmount);

    event RemoveLockHolder(address indexed to);

    
    function initialize() public initializer {
        __ERC20_init(TOKEN_NAME, TOKEN_SYMBOL);
        __ERC20Pausable_init();
        __Ownable_init();
        __AccessControlEnumerable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, owner());
        grantRole(MINT_ROLE, owner());   

        _initReleaseInfo();
    }

    function _initReleaseInfo() internal {
        // tokenPublishTime = 1672531200; //2023-1-1 0:0:0 UTC
        tokenPublishTime = 1672531200; //2023-1-1 0:0:0 UTC

        lockTypeCount = 5;

        // Investors
        lockTypeInfo[1] = LockTypeInfo(
            2 * 365 days,
            30 days,
            0,
            true
        );

        // Founders, Mozzler grant
        lockTypeInfo[2] = LockTypeInfo(
            4 * 365 days,
            30 days,
            0,
            true
        );

        // Team members
        lockTypeInfo[3] = LockTypeInfo(
            4 * 365 days,
            365 days,
            365 days,
            false
        );

        // Advisors
        lockTypeInfo[4] = LockTypeInfo(
            2 * 365 days,
            30 days,
            0,
            true
        );

        // Advisors
        lockTypeInfo[5] = LockTypeInfo(
            5 * 365 days,
            30 days,
            0,
            true
        );
    }   

    /**
     * @dev Mint `amount` tokens to `to`.
     */
    function mint(address to, uint256 amount) public validMint(amount) {
        require(hasRole(MINT_ROLE, _msgSender()), 'Not a minter');
        _mint(to, amount);
    }

    /**
     * @dev Burn `amount` tokens from `to`.
     */
    function burn(address from, uint256 amount) public {
        require(hasRole(MINT_ROLE, _msgSender()), 'Not a minter');
        _burn(from, amount);
    }

    /**
     * @dev see {IVeridaToken-addMinter}
     */
    function addMinter(address to) external onlyOwner override {
        require(!hasRole(MINT_ROLE, to), 'Already granted');
        require(to != address(0), 'Invalid zero address');

        grantRole(MINT_ROLE, to);

        emit AddMinter(to);
    }

    /**
     * @dev see {IVeridaToken-revokeMinter}
     */
    function revokeMinter(address to) external onlyOwner override {
        require(hasRole(MINT_ROLE, to), 'No minter');

        revokeRole(MINT_ROLE, to);

        emit RevokeMinter(to);
    }

    /**
     * @dev see {IVeridaToken-getMinterCount}
     */
    function getMinterCount() external view override returns(uint256){
        return getRoleMemberCount(MINT_ROLE);
    }

    /**
     * @dev see {IVeridaToken-getMinterList}
     */
    function getMinterList() external view override returns(address[] memory) {
        uint256 count = getRoleMemberCount(MINT_ROLE);
        address[] memory minterList = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            minterList[i] = getRoleMember(MINT_ROLE, i);
        }
        return minterList;
    }

    /**
     * @dev see {ITestUpgradeable}
     */
    function getVersion() external pure override returns(string memory){
        return "1.0";
    }

    /**
     * @dev See {IERC20-transfer}.
     * Checked for lockedAmount on transfer
     */
    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        uint256 balance = balanceOf(_msgSender());
        uint256 _lockedAmount = getLockedAmount(_msgSender());
        require(amount <= (balance - _lockedAmount), "Insufficient balance by lock");
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    /**
     * @dev add lock type info
     */
    function addLockType(uint256 lockDuration, uint256 releaseInterval, uint256 releaseDelay, bool isValidFromTGE) public {
        require(lockDuration > 0, "Invalid lock duration");
        require(releaseInterval > 0, "Invalid release interval");
        lockTypeCount++;
        lockTypeInfo[lockTypeCount] = LockTypeInfo(
            lockDuration,
            releaseInterval,
            releaseDelay,
            isValidFromTGE
        );
    }

    /** @dev Return locked amount. */
    function lockedAmount() public view returns(uint256) {
        return getLockedAmount(_msgSender());
    }

    /** @dev Get locked amount */
    function getLockedAmount(address to) internal view returns(uint256) {
        UserLockInfo storage userInfo = userLockInfo[to];
        LockTypeInfo storage lockInfo = lockTypeInfo[userInfo.lockType];
        
        if (userInfo.lockType == 0 || block.timestamp >= (userInfo.lockStart + lockInfo.lockDuration + lockInfo.releaseDelay)) {
            return 0;
        }
        
        if (block.timestamp < (userInfo.lockStart + lockInfo.releaseInterval + lockInfo.releaseDelay))
            return userInfo.lockAmount;

    
        uint256 releasePerInterval = userInfo.lockAmount * lockInfo.releaseInterval / lockInfo.lockDuration;
        uint256 intervalCount = (block.timestamp - userInfo.lockStart - lockInfo.releaseDelay) / lockInfo.releaseInterval;

        return (userInfo.lockAmount - (releasePerInterval * intervalCount));
    }

    /** @dev Add LockHolders. Mint locked amount.
     * This function can be removed in later versions once all locktypes are released.
     * @param to address of lock holder
     * @param _lockType can be one of 1 ~ lockTypeCount. 0 means general user not lock-up holder.
     * @param _lockAmount Initial locked-up amount
     * @param _lockStart start time of lock-up. This is only for lock types that is not validated from TGE
     */
    function addLockHolder(address to, uint8 _lockType, uint256 _lockAmount, uint256 _lockStart) public onlyOwner validMint(_lockAmount) {
        require(_lockType > 0 && _lockType <= lockTypeCount, "Invalid lock type");
        require(_lockAmount > 0, "Invalid lock amount");
        if (lockTypeInfo[_lockType].isValidFromTGE) {
            require(block.timestamp < tokenPublishTime, "Token published");
        } else {
            require(_lockStart >= block.timestamp, "Invalid lock start time");
        }

        UserLockInfo storage userInfo = userLockInfo[to];
        if (userInfo.lockType != 0) {
            _burn(to, userInfo.lockAmount);
        }

        _mint(to, _lockAmount);

        userInfo.lockType = _lockType;
        userInfo.lockAmount = _lockAmount;
        userInfo.lockStart = lockTypeInfo[_lockType].isValidFromTGE ? 
            ( tokenPublishTime ) :
            (_lockStart );

        emit AddLockHolder(to, _lockType, _lockAmount);
    }

    /** @dev Remove LockHolder. Burn locked amount. 
     * This function can be removed in later versions once all locktypes are released.
     */
    function removeLockHolder(address to) public onlyOwner {
        UserLockInfo storage userInfo = userLockInfo[to];
        require(userInfo.lockType > 0 && userInfo.lockType <= lockTypeCount, "Not a lock holder");

        LockTypeInfo storage lockInfo = lockTypeInfo[userInfo.lockType];

        if (lockInfo.isValidFromTGE) {
            require(block.timestamp < tokenPublishTime, "Token published");
            _burn(to, userLockInfo[to].lockAmount);
        } else {
            _burn(to, getLockedAmount(to));
        }
        delete userLockInfo[to];

        emit RemoveLockHolder(to);
    }

    function decimals() public view virtual override returns (uint8) {
        return DECIMAL;
    }


    
}