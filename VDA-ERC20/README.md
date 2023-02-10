# VDA-ERC-20 contract
This is the primary token contract of Verida. <br>
## Token Information
<table style="border:1px solid black; border-style:dotted">
<tr>
    <td><b>Token Name</b></td>
    <td>Verida</td>
</tr>
<tr>
    <td><b>Token Symbol</b></td>
    <td>VDA</td>
</tr>
<tr>
    <td><b>Decimal</b></td>
    <td>18</td>
</tr>
<tr>
    <td><b>Max Supply</b></td>
    <td>1_000_000_000 * (10 ^ 18)</td>
</tr>
</table>

## Amount Limit
<table>
    <tr>
        <td>Max amount per wallet</td>
        <td>limited up to 30% of <b>Max Supply<b></td>
    </tr>
    <tr>
        <td>Max amount per sell</td>
        <td>limited up to 30% of <b>Max Supply<b></td>
    </tr>
    <tr>
        <td></td>
        <td></td>
    </tr>
</table>

## Owner Permissions
Owner of the contract have following permissions:
- Add/Revoke minters
- Update **Max amount per wallet**
- Exclude addresses from wallet amount limit
- Enable/disable **Max amount per sell** feature
- Update **Max amount per sell**
- Exclude addresses from sell amount limit
- Enable/disable AMM Pair addresses
- Enable transfer

# Token Mint
**Verida** tokens can be minted by the contract owner or minters who are allowed by the contract owner.
## Add/Revoke minter
Only the contract owner can add or revoke the minters.
```
function addMinter(address to) external;
function revokeMinter(address to) external;
```
## Mint
Contract owner or minters can mint the tokens up to **Max Supply** by following function:
```
function mint(address to, uint256 amount) external;
```
Every address can not hold more than **Max amount per wallet**.

## Burn
Any token holders can burn tokens by following function:
```
function burn(address from, uint256 amount) external;
```

## **Max amount per wallet** feature
Once this feature enabled, every addresses are limited to the holdig amount. Each address can hold **Verida** tokens up to **maxAmountPerWallet**.
The contract owner enable this feature by following function:
```
function enableMaxAmountPerWallet(bool isEnabled) external;
```
By deault, this feature is disabled.

### Exclude addresses from **Max amount per wallet** feature
Contract owner can exclude specific addresses from this feature by following function:
```
function excludeFromWalletAmountLimit(address account, bool excluded) external;
```

# Token Transfer
After token published, token transfer is not allowed till the contract owner enable it. Though token transfer is not allowed, tokens can be minted.
## Enable token transfer
Only the contract owner can enable by following function:
```
function enableTransfer() external;
```
Once enabled, even the contract owner can not disable this feature again.
## Transfer between users
There isn't any limit to the transfer between users.<br>

## Sell amount limit
Contract owner can enable/disable selling amount limit by following function:
```
function enableMaxAmountPerWallet(bool isEnabled) external;
```
### Set/Unset the AMM addresses
**Sell amount limit** is subjected to the AMM addresses which the contract owner manage.<br>
The contract owner can set/unset AMM addresses by following function:
```
function setAutomatedMarketMakerPair(address pair, bool value) external;
```

### Exclude addresses from **Sell amount limit**
Contract owner can exclude specific addresses from the **Sell amount limit** feature by following function:
```
function excludeFromSellAmountLimit(address account, bool excluded) external;
```
By default, this feature is disabled.
