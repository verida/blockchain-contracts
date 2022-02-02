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

    // LockInfo List
    // mapping(address => LockInfo) lockInfoList;
    /** @dev LockType of each user. General users are not locked and type is 0 */
    mapping(address => LockType) public holderLockType;

    /** @dev lock total amount for each other */
    mapping(address => uint256) public lockTotal;

    /** @dev LockInfo of each LockType */
    mapping(uint256 => LockInfo) public lockInfo;

    /** @dev Release start time */
    uint256 releaseStart;

    /**
     * @dev LockInformation for each lock type. There is 4 'LockInfo's.
     */
    struct LockInfo {
        uint256 releaseDuration;
        uint256 releaseInterval;        
    }

    modifier validMint(uint256 amount) {
        require((totalSupply() + amount) <= MAX_SUPPLY, "Max supply limit");
        _;
    }

    event AddLockHolder(address indexed to, uint8 indexed lockType, uint256 lockAmount);

    event RemoveLockHolder(address indexed to);

    /**
     * @dev Lock type of Holders.
     */
    enum LockType {
        None, Seed, Founder, Team, Advisor
    }
    
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
        // releaseStart = 1672531200; //2023-1-1 0:0:0 UTC
        releaseStart = 1672531200; //2023-1-1 0:0:0 UTC
        // Seed Investors
        lockInfo[1] = LockInfo(
            2 * 365 days,
            30 days
        );

        // Founders
        lockInfo[2] = LockInfo(
            4 * 365 days,
            30 days
        );

        // Team members
        lockInfo[3] = LockInfo(
            3 * 365 days,
            365 days
        );

        // Advisors
        lockInfo[4] = LockInfo(
            2 * 365 days,
            30 days
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

    /** @dev Get current lock type of a user*/
    function getLockType(address to) external view returns(uint8) {
        return uint8(holderLockType[to]);
    }

    /** @dev Return locked amount. */
    function lockedAmount() public view returns(uint256) {
        return getLockedAmount(_msgSender());
    }

    /** @dev Get locked amount */
    function getLockedAmount(address to) internal view returns(uint256) {
        uint8 lockType = uint8(holderLockType[to]);
        LockInfo storage info = lockInfo[lockType];

        if (lockType == uint8(LockType.None) || 
            block.timestamp >= (releaseStart + info.releaseDuration)) {
            return 0;
        }
        
        if (block.timestamp < releaseStart)
            return lockTotal[to];

        // Calculate locked amount
        uint256 intervalCount = info.releaseDuration / info.releaseInterval;
        if (info.releaseDuration % info.releaseInterval != 0)
            intervalCount++;

        uint256 releasePerInterval = lockTotal[to] / intervalCount;
        intervalCount = (block.timestamp - releaseStart) / info.releaseInterval;

        return (lockTotal[to] - (releasePerInterval * intervalCount));
    }

    /** @dev Add LockHolders. Mint locked amount.
     * This function can be removed in later versions once all locktypes are released.
     */
    function addLockHolder(address to, uint8 _lockType, uint256 _lockAmount) public onlyOwner validMint(_lockAmount) {
        require(_lockType > uint8(LockType.None) && _lockType <= uint8(LockType.Advisor), "Invalid lock type");
        require(_lockAmount > 0, "Invalid lock amount");
        require(block.timestamp < releaseStart, "Release started");
        
        if (holderLockType[to] != LockType.None) {
            _burn(to, lockTotal[to]);
        }

        holderLockType[to] = LockType(_lockType);
        lockTotal[to] = _lockAmount;
        _mint(to, _lockAmount);

        emit AddLockHolder(to, _lockType, _lockAmount);
    }

    /** @dev Remove LockHolder. Burn locked amount. 
     * This function can be removed in later versions once all locktypes are released.
     */
    function removeLockHolder(address to) public onlyOwner {
        uint8 userLockType = uint8(holderLockType[to]);
        require(userLockType > 0 && userLockType <= uint8(LockType.Advisor), "Not a lock holder");
        require(block.timestamp < releaseStart, "Release started");

        _burn(to, lockTotal[to]);
        delete lockTotal[to];
        delete holderLockType[to];

        emit RemoveLockHolder(to);
    }

    function decimals() public view virtual override returns (uint8) {
        return DECIMAL;
    }
    
}