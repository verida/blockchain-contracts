# Contract Explain
## Description

## Requirements
- Token ID starts from 1.
- Once minted, tokens can't be transferred to others.

## Mint
Any users can mint a token by following function:
```
function claimSBT(
    address did,
    string calldata sbtType,
    string calldata uniqueId,
    bytes calldata signature,
    bytes calldata proof
) external returns(uint);
```
- **sbtType** : SBT types provided by Verida. Ex : "twitter", "facebook", ...
- **uniqueId** : Uniques id of SBT type. It can be twitter/facebook ID.
- **signature** : Offchain signature signed by DID's private key.

`signature = sign(${sbtType}-${uniqueId}-${did}-${nonce}, didPrivateKey)`
- **proof** : Proof provided by Verida 
`proof = sign(${VeridaDID}-${userDID}, VeridaDIDPrivateKey)`

## Dependencies
### Verida contract dependency
This project dependes following verida contracts:
- `@verida/vda-verification-base`
- `@verida/common-contract`

Link above dependencies by following command in terminal:
```
yarn link @verida/vda-verification-base
yarn link @verida/common-contract
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