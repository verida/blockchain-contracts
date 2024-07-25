2024-07-25 (v1.0.0)
-------------------
- Renamed `deRegisterApp()` function to `deregisterApp()`
- Renamed `DeRegisterApp` event to `DeregisterApp`
- Renamed `enableAppRegister()` function to `setAppRegisterEnabled()`
- Updated test codes for above changes
- Added `script/upgrade_manual.ts`

2024-07-23 (v1.0.0)
-------------------
- Added following functions in the `NameRegistryV1` contract
```ts
function isValidSuffix(string calldata suffix) external view returns(bool);
function getSuffixList() external view returns(string[] memory);
```

2024-07-18 (v1.0.0)
-------------------
- Update contract folder structure
- Create `NameRegistryV2` contract that support registering an application
- Update the test script

2023-12-08 (v0.4.1)
-------------------
- Fixed nonce no changed issue

2023-04-03 (v0.4.0)
-------------------
Updates on audit report
- Gas optimized
- Replaced the require statements with custom errors

2023-03-24 (v0.3.1)
-------------------
- Moved `EnumerableSet` & `StringLib` into the `VDA-Common` contract.

2023-03-15 (v0.3.0)
-------------------
- Multi-sign support added
- Solidity version upgraded to '0.8.18'
- Hardhat configuration updated