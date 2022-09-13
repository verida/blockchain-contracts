//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract RewardToken is ERC20Upgradeable, OwnableUpgradeable {
    string public constant TOKEN_NAME = "Verida Reward Token";
    string public constant TOKEN_SYMBOL = "VDAR";

    uint8   public constant DECIMAL = 18;
    uint256 public constant INIT_SUPPLY = 100_000 * (10 ** DECIMAL);
    uint256 public constant MAX_SUPPLY = 10_000_000 * (10 ** DECIMAL);

    event Mint(address to, uint amount);
    
    function __RewardToken_init(address rewardContract) public initializer {
        __Ownable_init();
        __ERC20_init(TOKEN_NAME, TOKEN_SYMBOL);
        __RewardToken_init_unchained(rewardContract);
    }

    function __RewardToken_init_unchained(address rewardContract) internal {
        _mint(rewardContract, INIT_SUPPLY);
        emit Mint(rewardContract, INIT_SUPPLY);
    }

    function decimals() public view virtual override returns (uint8) {
        return DECIMAL;
    }

    function mint(address to, uint amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Amount overflow max supply");
        _mint(to, amount);
        emit Mint(to, amount);
    }
}