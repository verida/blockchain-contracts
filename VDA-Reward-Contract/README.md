# Contract Explain
## Description
This contract receive signed off chain data and use that to provide a reward to the address making the request.

The key objectives are:

1. Provide a token reward for Verida Vault users to incentivize use of the testnet
2. Demonstrate our off-chain to on-chain data verification capabilities


## Dependencies
### Verida contract dependency
- `@verida/vda-verification-contract` : VDA-Verification-Base contract
- `@verida/erc20-contract` : VDA-ERC20 - Used in test script
- `@verida/storage-node-registry` : Need the deployed address of`VDA-StorageNodeRegistry-Contract` to deploy

# Test & Deploy
## Test
You can run test by following command:
```
    yarn test test/index.ts
``` 

## Deploy
### Deployment parameters
- Reward token address : Address of the Verida token contract
- StorageNode registry contract address : Address of `VDA-StorageNode-Registry` contract
### Deployment scripts
You can deploy contract by following command:
```
    yarn deploy --network <Target Network>
```
At the moment, there are 2 available networks:
- polygontestnet
- polygonmainnet

__Example__: Deploying to polygon mainnet
```
    yarn deploy --network polygonmainnet
```

## Verify
Once you deployed contract, you could see the deployed contract address in the terminal or in the `scripts/contract-address.json`

You can verify your contract by following command:
```
    yarn verify <Contract Address> --network <Target Network>
```