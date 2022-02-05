//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
// import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

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

    uint32 public constant RATE_DENOMINATOR = 1000; // Set up rate from 0.001%

    // Rate values can be set up to 30%
    uint32 public constant AMOUNT_RATE_LIMIT = 30 * RATE_DENOMINATOR;
    
    uint32 public maxAmountPerWalletRate;
    uint32 public maxAmountPerSellRate;

    uint256 private maxAmountPerWallet;
    uint256 private maxAmountPerSell;
    

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
     * Store addresses that a automatic market make pairs.
     * Any transfers to these addresses could be subject to a maximum transfer amount
     */
    mapping(address => bool) public automatedMarketMakerPairs;
    /**
     * @dev Uniswap Router
     */
    IUniswapV2Router02 public uniswapV2Router;

    /** @dev Current automatic market maker pair */
    address public uniswapV2Pair;

    modifier validMint(uint256 amount) {
        require((totalSupply() + amount) <= MAX_SUPPLY, "Max supply limit");
        _;
    }

    event UpdateUniswapV2Router(
        address indexed newAddress,
        address indexed oldAddress
    );

    event SetAutomatedMarketMakerPair(address indexed pair, bool indexed value);

    event UpdateMaxAmountPerWalletRate(uint32 newRate, uint32 oldRate);

    event UpdateMaxAmountPerSell(uint32 newRate, uint32 oldRate);

    
    function initialize() public initializer {
        __ERC20_init(TOKEN_NAME, TOKEN_SYMBOL);
        __ERC20Pausable_init();
        __Ownable_init();
        __AccessControlEnumerable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, owner());
        grantRole(MINT_ROLE, owner());   

        _initLockupType();

        maxAmountPerSellRate = 1000; //1000 % RATE_DENOMINATOR = 0.1%
        maxAmountPerWalletRate = 20 * RATE_DENOMINATOR; // 20%
        _updateMaxAmountPerWallet();
        _updateMaxAmountPerSell();

        // _initSwap();

    }

    /**
     * @dev Initialize lock-up types.
     */
    function _initLockupType() internal {
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
     * @dev Initialize Uniswap features
     */
    function _initSwap() internal {
        address routerAddress = 
            0x1Ed675D5e63314B760162A3D1Cae1803DCFC87C7 // BSC TestNet (ME)
            // 0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3 //TestNet (John)
            // 0x10ED43C718714eb63d5aA57B78B54704E256024E // BSC Mainnet
        ;

        uniswapV2Router = IUniswapV2Router02(
            routerAddress
        );

        uniswapV2Pair = IUniswapV2Factory(uniswapV2Router.factory()).createPair(
            address(this),
            uniswapV2Router.WETH()
        );

        _setAutomatedMarketMakerPair(uniswapV2Pair, true);
    }

    /** @dev Decimals of Verida token */
    function decimals() public view virtual override returns (uint8) {
        return DECIMAL;
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
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {

        // No need
        require(amount <= (balanceOf(sender) - getLockedAmount(sender)), 
            "Insufficient balance by lock");

        require((balanceOf(recipient) + amount) < maxAmountPerWallet, 
            "Receiver amount exceeds limit");

        // isSelling
        if (automatedMarketMakerPairs[recipient]) {
            require(amount < maxAmountPerSell, 'Sell amount exceeds limit');
        }
        
        super._transfer(sender, recipient, amount);
    }

    /**
     * @dev See {IVDA}
     */
    function addLockType(uint256 lockDuration, uint256 releaseInterval, uint256 releaseDelay, bool isValidFromTGE) external override {
        require(lockDuration > 0, "Invalid lock duration");
        require(releaseInterval > 0, "Invalid release interval");
        lockTypeCount++;
        lockTypeInfo[lockTypeCount] = LockTypeInfo(
            lockDuration,
            releaseInterval,
            releaseDelay,
            isValidFromTGE
        );

        emit AddLockType(lockTypeCount, lockDuration, releaseInterval, releaseDelay, isValidFromTGE);
    }

    /** @dev See {IVDA} */
    function lockedAmount() external view override returns(uint256) {
        return getLockedAmount(_msgSender());
    }

    /** @dev Get locked amount */
    function getLockedAmount(address to) private view returns(uint256) {
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

    /**
     * @dev See {IVDA}
     */
    function addLockHolder(address to, uint8 _lockType, uint256 _lockAmount, uint256 _lockStart) external onlyOwner validMint(_lockAmount) override {
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

    /** 
     * @dev see {IVDA}
     */
    function removeLockHolder(address to) external onlyOwner override {
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

    /**
     * @dev Update uniswapV2Router.
     */
    function updateUniswapV2Router(address newAddress) public onlyOwner {
        require(newAddress != address(uniswapV2Router));
        emit UpdateUniswapV2Router(newAddress, address(uniswapV2Router));
        uniswapV2Router = IUniswapV2Router02(newAddress);
    }

    /**
     * @dev enable/disable AutomatedMarkertMakerPair
     */
    function setAutomatedMarketMakerPair(address pair, bool value) public onlyOwner
    {
        require(pair != uniswapV2Pair);
        _setAutomatedMarketMakerPair(pair, value);
    }

    /**
     * @dev internal function to set automated market maker pair.
     */
    function _setAutomatedMarketMakerPair(address pair, bool value) private {
        automatedMarketMakerPairs[pair] = value;

        emit SetAutomatedMarketMakerPair(pair, value);
    }

    /**
     * @dev update max amount per wallet percent.
     */
    function updateMaxAmountPerWalletRate(uint32 newRate) public onlyOwner {
        require(newRate < AMOUNT_RATE_LIMIT, 'Invalid rate');

        emit UpdateMaxAmountPerWalletRate(newRate, maxAmountPerWalletRate);

        maxAmountPerWalletRate = newRate;
        _updateMaxAmountPerWallet();
    }

    /**
     * @dev Update max amount per wallet.
     * called when rate updated or total supply updated.
     */
    function _updateMaxAmountPerWallet() private {
        maxAmountPerWallet = MAX_SUPPLY * maxAmountPerWalletRate / (RATE_DENOMINATOR * 100);
    }

    /**
     * @dev update max amount per sell percent.
     */
    function updateMaxAmountPerSellRate(uint32 newRate) public onlyOwner {
        require(newRate < AMOUNT_RATE_LIMIT, 'Invalid rate');

        emit UpdateMaxAmountPerSell(newRate, maxAmountPerSellRate);

        maxAmountPerSellRate = newRate;
        _updateMaxAmountPerSell();
    }

    /**
     * @dev Update max amount per sell.
     * called when rate updated or total supply updated.
     */
    function _updateMaxAmountPerSell() private {
        maxAmountPerSell = MAX_SUPPLY * maxAmountPerSellRate / (RATE_DENOMINATOR * 100);
    }


}