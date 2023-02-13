//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";

import "./IVDA.sol";

contract VeridaTokenV2 is ERC20PausableUpgradeable, OwnableUpgradeable, 
    AccessControlEnumerableUpgradeable {

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
    
    /**
     * @dev return current version of Verida Token
     */
    function getVersion() external pure returns(string memory){
        return "2.0";
    }
}