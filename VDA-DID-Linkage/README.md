# Contract Explain
## Description

This contract link a Verida DID to any other type of identifier. This will allow other identifiers to be used as a alias  to refer to a Verida DID.

## Requirements
- As a Verida Account I can link my DID to a blockchain account
- As a Verida Account I can link my DID to a Twitter account if I prove I control it
- As a Verida Account I can link my DID to a Facebook account if I prove I control it
- As a Verida Account I can link my DID to a Github account if I prove I control it
- As a Smart Contract I can verify a DID controls a given twitter handle or blockchain address

## Dependencies
### Verida contract dependency
This contract has dependencies to following verida contracts:
- `@verida/vda-verification-contract`
- `@verida/common-contract`

As these contracts are not published, you should link them by `yarn link <package name>` command.<br>
Example: <br>
```
    yarn link @verida/vda-verification-contract
```

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