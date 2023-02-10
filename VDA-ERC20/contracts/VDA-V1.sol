//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";

import "./IVDA.sol";

// import "hardhat/console.sol";

contract VeridaToken is ERC20PausableUpgradeable, OwnableUpgradeable, 
    IVeridaToken, AccessControlEnumerableUpgradeable {

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

    bool public isMaxAmountPerWalletEnabled;
    bool public isMaxAmountPerSellEnabled;
    bool public isTransferEnabled;

    mapping(address => bool) public isExcludedFromSellAmountLimit;
    mapping(address => bool) public isExcludedFromWalletAmountLimit;
    

    /**
     * Store addresses that a automatic market make pairs.
     * Any transfers to these addresses could be subject to a maximum transfer amount
     */
    mapping(address => bool) public automatedMarketMakerPairs;
    
    modifier validMint(uint256 amount) {
        require((totalSupply() + amount) <= MAX_SUPPLY, "Max supply limit");
        _;
    }

    event SetAutomatedMarketMakerPair(address indexed pair, bool indexed value);

    event UpdateMaxAmountPerWalletRate(uint32 newRate, uint32 oldRate);

    event UpdateMaxAmountPerSell(uint32 newRate, uint32 oldRate);

    event ExcludeFromSellAmountLimit(address indexed account, bool excluded);

    event ExcludeFromWalletAmountLimit(address indexed account, bool excluded);

    event EnableMaxAmountPerWallet(bool isEnabled);

    event EnableMaxAmountPerSell(bool isEnabled);
    
    function initialize() external initializer {
        __ERC20_init(TOKEN_NAME, TOKEN_SYMBOL);
        __ERC20Pausable_init();
        __Ownable_init();
        __AccessControlEnumerable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, owner());
        grantRole(MINT_ROLE, owner());

        maxAmountPerSellRate = 100; //100 / RATE_DENOMINATOR = 0.1%
        maxAmountPerWalletRate = 20 * RATE_DENOMINATOR; // 20%
        _updateMaxAmountPerWallet();
        _updateMaxAmountPerSell();

        isExcludedFromSellAmountLimit[owner()] = true;
        isExcludedFromWalletAmountLimit[owner()] = true;
        isTransferEnabled = false;
    }

    /** @dev Decimals of Verida token */
    function decimals() public view virtual override returns (uint8) {
        return DECIMAL;
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
     * @dev return current version of Verida Token
     */
    function getVersion() external pure returns(string memory){
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

        // Allow if isTransferEnabled or Minting operation
        require(isTransferEnabled || sender == address(0), "Token transfer not allowed");

        if (isMaxAmountPerWalletEnabled && !isExcludedFromWalletAmountLimit[recipient]) {
            require((balanceOf(recipient) + amount) <= maxAmountPerWallet, 
                "Receiver amount limit");
        }

        // isSelling
        if (isMaxAmountPerSellEnabled 
            && automatedMarketMakerPairs[recipient]
            && !isExcludedFromSellAmountLimit[sender]) 
        {
            require(amount <= maxAmountPerSell, "Sell amount exceeds limit");
        }
        
        super._transfer(sender, recipient, amount);
    }
    
    
    /**
     * @dev enable/disable AutomatedMarkertMakerPair
     */
    function setAutomatedMarketMakerPair(address pair, bool value) external onlyOwner
    {
        require(automatedMarketMakerPairs[pair] != value, "Already set");
        automatedMarketMakerPairs[pair] = value;

        emit SetAutomatedMarketMakerPair(pair, value);
    }

    /**
     * @dev update max amount per wallet percent.
     */
    function updateMaxAmountPerWalletRate(uint32 newRate) external onlyOwner {
        require(newRate <= AMOUNT_RATE_LIMIT, "Invalid rate");
        require(newRate > 0, "Invalid rate");

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
    function updateMaxAmountPerSellRate(uint32 newRate) external onlyOwner {
        require(newRate <= AMOUNT_RATE_LIMIT, "Invalid rate");
        require(newRate > 0, "Invalid rate");

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

    /**
     * @dev exclude account from sell amount limit
     */
    function excludeFromSellAmountLimit(address account, bool excluded) external onlyOwner {
        require(isExcludedFromSellAmountLimit[account] != excluded);
        isExcludedFromSellAmountLimit[account] = excluded;
        emit ExcludeFromSellAmountLimit(account, excluded);
    }

    /**
     * @dev exclude account from wallet amount limit
     */
    function excludeFromWalletAmountLimit(address account, bool excluded) external onlyOwner {
        require(isExcludedFromWalletAmountLimit[account] != excluded);
        isExcludedFromWalletAmountLimit[account] = excluded;
        emit ExcludeFromWalletAmountLimit(account, excluded);
    }

    /**
     * @dev enable/disable MaxAmountPerSell
     */
    function enableMaxAmountPerSell(bool isEnabled) external onlyOwner {
        require(isMaxAmountPerSellEnabled != isEnabled);
        isMaxAmountPerSellEnabled = isEnabled;
        emit EnableMaxAmountPerSell(isEnabled);        
    }

    /**
     * @dev enable/disable MaxAmountPerWallet
     */
    function enableMaxAmountPerWallet(bool isEnabled) external onlyOwner {
        require(isMaxAmountPerWalletEnabled != isEnabled);
        isMaxAmountPerWalletEnabled = isEnabled;
        emit EnableMaxAmountPerWallet(isEnabled);
    }

    /**
     * See {IVDA.sol}
     */
    function enableTransfer() external onlyOwner override {
        require(!isTransferEnabled, "Transfer enabled");

        isTransferEnabled = true;
    }
}