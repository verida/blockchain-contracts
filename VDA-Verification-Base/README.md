# Contract Explain
## Description
This is a parent contract of all verida contracts that use proof verification feature.
This contract is for contract developers of **Verida**.

## Project structure
### Contract files

- **VDAVerficationContract.sol** : This is a verification contract.
- **TestContract.sol** : Created for test purpose. It includes test functions too.

### Test files
- index.ts : Test the basic `verification` feature
- proof.ts : Test with interaction to the blockchain. DID-Document & DID-Client used
- signTest.ts : This is for signing test. Not for VDA-Verification-Base.

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