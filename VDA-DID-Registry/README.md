# Description
This contract manage DIDs. Users can register and revoke their DIDs.<br>
Also, users can set controller of their DIDs. There are more functions to manage DIDs.
## Mock contracts for testing
There are mock contracts that used in test.
- `contracts/VeridaDIDRegistryV2.sol` : Used for proposing upgrade in the `scripts/propose-upgrade.ts`

## Verida library dependency
This contract has dependencies to following verida libraries:
- `@verida/encryption-utils` : Used for test

# Test
## Install dependencies
Inside project directory, run following command:
```
yarn install
```

## Test
Inside project directory, run following command:
```
yarn test test/index.ts
```
