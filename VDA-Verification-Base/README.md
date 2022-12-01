# VDAVerificationContract

This is a parent contract of all verida contracts that use proof verification feature.
This contract is for contract developers of **Verida**.

## Explain of contract files

- **VDAVerficationContract.sol** : This is a verification contract.
- **TestContract.sol** : Created for test purpose. It includes test functions too.

## Test files
- index.ts : Test the basic `verification` feature
- proof.ts : Test with interaction to the blockchain. DID-Document & DID-Client used
- signTest.ts : This is for signing test. Not for VDA-Verification-Base.

## Build & Test
Describes in Ubuntu OS.

Open terminal and go to project directory by using `cd <PROJECT_PATH>` command.
### Install dependencies
```
yarn install
```
### Compile
```
npx hardhat compile
```
### Test
```
npx hardhat test
```