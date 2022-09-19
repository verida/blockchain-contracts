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

## Deploy

Can deploy contract on the chains. At the moment, deploy script is supported polygon mainnet & polygon testnet.
To add more chains, configure `hardhat.config` file in the project.

Run following command in the terminal:
```
npx hardhat run scripts/deploy.ts --network <NETWORK_NAME>
```
Here <NETWORK_NAME> can be one of following:
- polygonmainnet
- polygontestnet

Example: Deploy contract on polygon test net
```
npx hardhat run scripts/deploy.ts --network polygontestnet
```
**Warning** : Once VDARewardContract deployed, 10000 VDAR tokens would be minted to the deployed contract. To do so, private key should be the same for RewordToken deployment & RewardContract deployment. Meaning, we need to use the same `"PRIVATE_KEY=..."` field in the .env files.