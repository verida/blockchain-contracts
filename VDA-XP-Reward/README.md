# Verida XP Rewards
## Description
This contract receive signed off chain data (including Verida XP points) and use that to provide a reward to the address in the input parameters. The contract owner set and update XP to token conversion rate.

The key objectives are:

1. Every month, VDA is deposited into the smart contract as reward tokens
2. Every month, Verida users can provide a proof of a signed data record containing XP points
3. Data will be signed by a trusted Verida whitelisted DID
4. Users can claim more than one XP proof at a time
5. XP proofs are generated in one month, and can only be claimed in the following month
6. Users that don't claim their XP in the correct month, forfeight their XP rewards
7. Each month will have a different XP to VDA conversion rate
8. Only the contract owner can change the XP to VDA conversion rate
9. Any unclaimed VDA will be included in the next month reward pool
10. Each proof can only be used once
11. If a uniqueId is specified, it can only be claimed once for a given combination of typeId and uniqueId

__*Reference*__

https://github.com/verida/blockchain-contracts/issues/152

## Dependencies
### Verida contracts
This contract depends on the following Verida contract:
- `@verida/vda-verification-contract` : Used to manage the trusted signers and verify the `claimXPReward()` request
- `@verida/erc20-contract` : VDA-ERC20 - Used in test script
### `verida-js ` packages
This contract depends on the following `verida-js` packages:
- `@verida/encryption-utils` : Used in test script


# Test & Deploy
## Test
You can run test by following command:
```
    yarn test test/index.test.ts
``` 

## Deploy
### Update contract addresses
Update the contract addresses at line#13 in the `./scripts/deploy.ts`
```ts
  const rewardTokenAddress = "<Input the Token contract address>";
```
### Deploy
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