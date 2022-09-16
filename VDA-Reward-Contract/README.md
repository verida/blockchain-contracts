# Verida Reward Contract

This contract receive signed off chain data and use that to provide a reward to the address making the request.

The key objectives are:

1. Provide a token reward for Verida Vault users to incentivize use of the testnet
2. Demonstrate our off-chain to on-chain data verification capabilities

## Build
Run following command in project directory:
```
npx hardhat compile
```

## Test

This uses @verida/encryption-utils package in verida-js library.
Before test link @verida/encryption-utils:
- Run `yarn link` inside the encryption-utils package of verida-js
- Run `yarn link @verida/encryption-utils` inside the current project directory

Test by following command inside current project directory:
```
npx hardhat test
```