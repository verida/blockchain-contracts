# Purpose of this contract
This is a lockUp contract for employees.
Verida tokens (or any other ERC20Upgradable tokens) will be locked for individual employees with kinds of lock-up settings.

Lock-up settings contains following:
  - lock start time
  - lock-up duration
  - release interval
  - release delay

# Contract Features
## Token Setup
The lock-up token is set when deploying this contract. There is an input parameter for token address in the `initialize` function:
```
function initialize(address tokenAddress)
```
`tokenAddress` is an address of the ERC20Upgradeable contract. Otherwise, the contract will not be deployed.

Before adding employees, there must be enough tokens in the contract.
Anyone can transfer tokens to this contract using general token transferring methods. There are no functions to deposit tokens in this contract. 

The owner can withdraw unlocked tokens at any time. There are 2 functions to withdraw unlocked tokens:
```
function withdrawUnlockedTokens()
function withdrawUnlockedTokensTo(address to)
```
The first function will withdraw tokens to the owner's address, while the second one withdrawing to the input address.

## LockType
LockType is a lock-up setting applied to individual employees. LockType includes lock duration, release interval, & release delay (3 properties of the above lock-up setting). Lock start time will be different per each employee and it will be set up on employee add (Will be explained in `Add/Remove Employee` section.

Initially there is only one LockType:
  - lock-up duration: 365 days
  - release interval: 30 days
  - release delay: 365 days

Only the owner of this contract can add additional LockTypes. And there is no function for removing LockTypes.
Owner can add LockTypes using `addLockType(uint256 lockDuration, uint256 releaseInterval, uint256 releaseDelay)` function.

## Add/Remove Employee
Only the owner can add or remove employees.
The owner can add an employee by one of the following 2 functions:
```
  addRecipient(address to, uint256 _lockAmount, uint256 _lockStart)
  addRecipientWithLockType(address to, uint256 _lockAmount, uint256 _lockStart, uint8 _lockType)
```
Here `_lockType` points to the index of LockType. Index of LockType starts from 1.
Once `_lockType` is not set, employee will be added with default LockType(index = 1).

Adding will be failed in following cases:
  - `_lockType` is invalid
  - `_lockAmount` is 0.
  - `_lockStart` is before thant current block time.
  -  Insufficient tokens in the contract.

The owner can remove any employee at any time by `removeRecipient(address to)`. Once an employee is removed, previously locked tokens for him will be released to the contract.

## Employee
An employee can check his locked amounts by `lockedAmount()` function.
He can check out the claimable amount by `claimableAmount()` function.
He can claim tokens by `claim()` function.