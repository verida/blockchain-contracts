# Verida Name Registry

This contract manage unique Verida names/aliases that point to Verida DIDs.

## Name & Suffixes
General users can register and unregister names to and from this contract.
Each name has a suffix followed by "." symbol.

**Example of a name** : "VeridaService.db"

At the moment, this contract assumes that each name contains only one "." symbol. If there are multiple "." in the name, strings after the first "." symbol will be processed as a suffix. For example, if user send "service.odd.db" as a name parameter, "odd.db" will be processed as a suffix.

Suffixes are added by the contract owenr - Verida.

## User kinds of this contract
There are 2 kinds of users for this contract.
### __General users__
General users can do the following:
- Register a name
- Unregister a registered name
- Find a DID of a registered name
- Get the registered name list of a DID

### __Owner - Verida__
Contract owner can do the following:
- Add a suffix


# Build & Test

Open terminal (ubuntu) and navigate to the project directory.
```
cd <PROJECT_PATH>
```
Run following commands:
## Build
```
npx hardhat compile
```
## Test
```
npx hardhat test
```
### **Test Dependencies**
This project dependes on following libraries in verida-js:
- @verida/encryption-utils

Link above dependencies by `yarn link <dependency name>` command.
```
yarn link @verida/encryption-utils
```
## Deploy
```
npx hardhat run scripts/deploy.ts --network <TARGET_NET>
```
Here <TARGET_NET> is one of the networks configured in hardhat.config.ts file in the project directory.
For example, if you're deploying contract to polygon testnet do the following:
```
npx hardhat run scripts/deploy.ts --network polygontestnet
```
Once deployed successfully, it prints the contract address in the terminal as following:
```
NameRegistry deployed to: 0x...
```
## Verify deployed contract
```
npx hardhat verify <CONTRACT_ADDRESS> --network <TARGET_NET>
```
Here, <CONTRACT_ADDRESS> is the contract address deployed in the above step.
And <TARGET_NET> should be the same one in the "Deploy" step.

## Upgrade contract
__Only the contract owner can upgrade the contract to the next version__
```
npx hardhat run scripts/upgrade.ts --network <TARGET_NET>
```

