---
title: "Ethereum DID Registry"
index: 0
category: "ethr-did-registry"
type: "reference"
source: "https://github.com/uport-project/ethr-did-registry/blob/develop/README.md"
---

# Description
This contract interacts with VDA-Ethr-DID JS libraries.
VDA-Ethr-DID library was forked from `https://github.com/uport-project/ethr-did` and customized for bulk transactions.

# Test
There is test script for bulk transactiosn: `test/bulkadd.test.ts` dir
## Install dependencies
Inside project directory, run following command:
```
yarn install
```

## Test
Inside project directory, run following command:
```
npx hardhat test test/bulkadd.test.ts
```

# Web3 test
Created node.js project for bulk transactions on BSC testnet & Polygon mainnet.
There are 2 files inside `node-test/` directory: `node-test/getlogs_bsc.js` & `node-test/getlogs_polygon.js`.

## Create key file
Inside `node-test/` directory, create `.evn.json` and input the private key of your account (MetaMask).

Example:
```
{
    "privateKey" : "352..."
}
```

## Install dependencies
Inside `node-test/` directory, run following command:
```
yarn install
```

## Test
Inside `node-test/` directory, run following command:
```
node getlogs_bsc.js
```
or
```
node getlogs_polygon.js
```
