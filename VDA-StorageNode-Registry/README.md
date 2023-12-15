# VDA Storage Node Registry

The selection of storage nodes occurs when a DID is first created and when a context is connected to for the first time. The storage nodes are used to store the actual DID Documents and the same nodes are typically (but not necessarily) used to store data for each application context. [Verida VIP - 10](https://github.com/verida/VIPs/blob/develop/VIPs/vip-10.md)


## Dependencies

This contract has no dependencies to any verida contracts:

## Testing

There are 4 test files inside "test" directory:
- `diamond.test.ts` : Test diamond features of add/remove/replace facets
- `datacenter.test.ts` : Test features related to the data centers
- `storagenode_manage.test.ts` : Test add/remove features of Storage Nodes
- `storagenode_log.test.ts` : Test logging issues of Storage Nodes.

You can run test by following command:
```
    yarn test <test file name>
``` 
_**Example**_:
```
    yarn test test/datacenter.test.ts
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