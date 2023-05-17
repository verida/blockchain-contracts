# VDA Storage Node Registry

The selection of storage nodes occurs when a DID is first created and when a context is connected to for the first time. The storage nodes are used to store the actual DID Documents and the same nodes are typically (but not necessarily) used to store data for each application context. [Verida VIP - 10](https://github.com/verida/VIPs/blob/develop/VIPs/vip-10.md)

## Contract owner specific features

Contract owner has following abilities:
- add datacenters
- remove datacenters

## Dependencies

This contract has dependencies to following verida contracts:
- `@verida/vda-verification-contract`

## Testing

You can run test by following command:
```
    yarn test test/index.test.ts
``` 

## Deployment

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

Once you deployed contract, you could see the deployed contract address in the terminal or in the `scripts/contract-address.json`

You can verify your contract by following command:

```
    yarn verify <Contract Address> --network <Target Network>
```