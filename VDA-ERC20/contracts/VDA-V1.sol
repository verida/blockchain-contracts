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

        tokenPublishTime = 1672531200; //2023-1-1 0:0:0 UTC

        maxAmountPerSellRate = 1000; //1000 % RATE_DENOMINATOR = 0.1%
        maxAmountPerWalletRate = 20 * RATE_DENOMINATOR; // 20%
        _updateMaxAmountPerWallet();
        _updateMaxAmountPerSell();

        // _initSwap();
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

    function getTokenPublishTime() external view override returns(uint256){
        return tokenPublishTime;
    }

    /**
     * @dev Mint `amount` tokens to `to`.
     */
    function mint(address to, uint256 amount) external validMint(amount) override {
        require(hasRole(MINT_ROLE, _msgSender()), 'Not a minter');
        _mint(to, amount);
    }

    /**
     * @dev Burn `amount` tokens from `to`.
     */
    function burn(address from, uint256 amount) external override {
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

        require((balanceOf(recipient) + amount) < maxAmountPerWallet, 
            "Receiver amount exceeds wallet limit");

        // isSelling
        if (automatedMarketMakerPairs[recipient]) {
            require(amount < maxAmountPerSell, 'Sell amount exceeds limit');
        }
        
        super._transfer(sender, recipient, amount);
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