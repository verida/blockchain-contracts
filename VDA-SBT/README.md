## Soulbound NFT
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

## Dependency of Verida contracts
This project dependes following verida contracts:
- @verida/vda-verification-base
- @verida/name-registry
- @verida/encryption-utils (For test purpose)

Link above dependencies by following command in terminal:
```
yarn link @verida/vda-verification-base
yarn link @verida/name-registry
yarn link @verida/encryption-utils
```

