2024-01-30 (v0.5.0)
-------------------
- Added `getTokenAddress()` and `getStorageNodeContractAddress()` functions

2024-01-23 (v0.4.1)
-------------------
- Fixed the deployment script
- Updated the `README.md`

2024-01-23 (v0.4.0)
-------------------
- Added `claimToStorage()` function : issue#136

2024-01-22 (v0.3.3)
-------------------
- Removed unnecessary code and test code: Custom error "InsufficientTokenAmount" is unnecessary, checked by default inside ERC20's `_transfer()` function

2024-01-22 (v0.3.2)
-------------------
- [Audit-Update] Update `claim()` function to prevent front-running attack. 

2023-12-15 (v0.3.1)
-------------------
- Added timeout parameters to deployment script

2023-04-06 (v0.3.0)
-------------------
- Add scripts for multi-sign support
- Update `scripts/deploy.ts` script to save address

2023-04-03 (v0.2.0)
-------------------
Updates on audit report
- Gas optimized
- Replaced the require statements with custom errors

2023-03-24 (v0.1.2)
-------------------
- Solidity upgraded to '0.8.18'
- Hardhat configuration upgraded

2023-02-15 (v0.1.1)
-------------------
- Reward contract inherits `@verida/vda-verification-contract`
- Update reward token to `@verida/erc20-contract ` - Verida token : Used in test script