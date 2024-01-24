2024-01-24 (V1.0.0)
-------------------
- Untrack script/*.json files

2024-01-23 (V1.0.0)
-------------------
- Add `depositTokenFromProvider`

2024-01-22 (V1.0.0)
-------------------
- Add recipient address parameter to the `withdraw()` function
- Add recipient address parameter to the `removeNodeComplete()` function

2024-01-18 (V1.0.0)
-------------------
- Add enable/disable withdrawal feature in the StorageNodeFacet
```ts
function isWithdrawalEnabled() external view returns(bool);
function setWithdrawalEnabled(bool isEnabled) external;
```
- Added test code for above functions

2023-12-12 (V1.0.0)
-------------------
- Add `getVDATokenAddress()` function
- Added test code for `getVDATokenAddress()` function
- Added `scripts/verify.ts` to verify all diamod contracts automatically

2023-12-12 (V1.0.0)
-------------------
- Update function names in `VDADataCenterFacet` contract
    `isDataCenterNameRegistered()` -> `isRegisteredDataCenterName`
- Update function names in `VDAStorageNodeManagementFacet` contract
    `isRegisteredName()` -> `isRegisteredNodeName()`
    `isRegisteredAddress()` -> `isRegisteredNodeAddress()`
    `isRegisteredEndpoint()` -> `isRegisteredNodeEndpoint()`
- Update deployment script : Added `diamondInit` contract address to the `script\contract-address.json`

2023-12-08 (V1.0.0)
-------------------
- **Update deployment script:**
    Deploy primite facets first, and then diamond contract with less deployment arguments. After diamond deployed, add another facets using the `DiamondCutFacet`. Thus, we can verify the diamond cotract with less arguments.

- Renamed duplicated function names in `VDADataCenterFacet` contract:
```ts
function getDataCentersByCountryAndStatus(countryCode, status)...;
function getDataCentersByRegionAndStatus(regionCode, status) ...;
```
- Renamed duplicated function names in `VDAStorageNodeManagementFacet` contract:
```ts
function getNodesByCountryAndStatus(countryCode, status)...;
function getNodesByRegionAndStatus(regionCode, status)...;
```

2023-12-07 (V1.0.0)
-------------------
- Added `Decimal()` function to the `StorageNodeFacet` contract
```ts
function DECIMAL() external pure returns(uint8);
```
- Added checking function to `StorageNodeManagementFacet` contract
```ts
function isRegisteredName(string calldata name) external view returns(bool);
function isRegisteredAddress(address didAddress) external view returns(bool);
function isRegisteredEndpoint(string calldata endpointUri) external view returns(bool);
```
> As contract following the diamond standard, function are called by delegate call. In the `verida-js` packages, it can't know the rejected reason for `getNodeByName()`, `getNodeByAddress()`, and `getNodeByEndpoint()`. It makes the `verida-js` packages difficult to know whether the transaction rejected by invalid argument or web3 configuration.

2023-12-06 (V1.0.0)
-------------------
- Data centers are remained after removed. The status changed from "active" to "removed"
- Storage nodes are remained after removed. The status changed as following : "active" -> "removing" -> "removed"
- Updated test codes

2023-12-04 (V1.0.0)
-------------------
- Updated contract using diamond standard

2023-11-20 (V0.2.5)
-------------------
- Update `logNodeIssue()` function to reject when the `didAddress` and `nodeAddress` are the same
- Update `excessTokenAmount()` function to consider staking required flag
- Update test code

2023-11-15 (V0.2.4)
-------------------
- Added `removeDataCenterByName()` and `isDataCenterNameRegistered()` functions
- Updated `getDatacenterByName()` to `getDataCentersByName()`
- Added test code for above functions

2023-11-09 (V0.2.3)
-------------------
- Added `getDatacenterByName()` function
- Updated functions as `virtual`

2023-11-09 (V0.2.2)
-------------------
- Removed `updateTokenAddress()` function
- Updated decimal for latitude and longitude value from 8 to 9

2023-10-25 (v0.2.1)
-------------------
**Added Logging issue and Slash feature**
- Update `withdraw()` function so that any DID can call, because any DID can get slahed tokens by logging issues.
- Added functions for logging & slashing
```
function getNodeIssueFee() external view returns(uint);
function updateNodeIssueFee(uint value) external payable;
function getSameNodeLogDuration() external view returns(uint);
function updateSameNodeLogDuration(uint value) external payable;
function logNodeIssue(address didAddress, address nodeAddress, uint reasonCode, bytes calldata requestSignature, bytes calldata requestProof ) external;
function slash(address nodeDID, uint reasonCode, uint amount, string calldata moreInfoUrl) external payable;
```
- Added functions for owner to withdraw fees from logging issues
```
function getIssueFeeAmount() external view returns(uint);
function withdrawIssueFee(address to, uint amount) external payable;
```

- Added state variable in `SlotInfo` struct
```
totalIssueFee
```

2023-10-18 (v0.2.0)
-------------------
**Added staking feature while adding nodes**
- Add owner only function to update VDA token address
```
function updateTokenAddress(address newTokenAddress) external;
```
- Added state variables and functions to manage them
```
MIN_SLOTS
MAX_SLOTS
STAKING_Required
```
- Updated following functions to add staking feature
```
addNode()
removeNodeComplete()
```
- Added following functions related to staking feature
```
function depoistToken(address didAddress, uint tokenAmount) external;
function withdrawExcessToken(address didAddress, bytes calldata requestSignature, bytes calldata requestProof) external;
function getBalance(address didAddress) external view returns(uint);
function excessTokenAmount(address didAddress) external view returns(uint);
function isStakingRequired() external view returns(bool);
function setStakingRequired(bool isRequired) external;
function getStakePerSlot() external view returns(uint);
function updateStakePerSlot(uint newVal) external;
function getNumberSlotsRange() external view returns(uint, uint);
function updateMinSlots(uint minSlots) external;
function updateMaxSlots(uint maxSlots) external;
```
- Deploy scrip updated to set VDA Token address at contract deployment
- Test code updated


2023-05-10 (v0.1.0)
-------------------
- Initial version
- Test code completed
- `ReadMe.md` added
- `ChangeLog.md` added