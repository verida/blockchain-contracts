# Contract Explain
## Description
This contract manage DIDs. Users can register and revoke their DIDs.<br>
Also, users can set controller of their DIDs. There are more functions to manage DIDs.
### Mock contracts for testing
There are mock contracts that used in test.
- `contracts/VeridaDIDRegistryV2.sol` : Used for proposing upgrade in the `scripts/propose-upgrade.ts`

## Dependencies
### Verida library dependency
This contract has dependencies to following verida contracts:
- `@verida/common-contract`

# Test & Deploy
## Test
You can run test by following command:
```
    yarn test test/index.ts
``` 

## Deploy
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