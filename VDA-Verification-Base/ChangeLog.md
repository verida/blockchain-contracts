2024-05-03 (v0.2.0)
-------------------
- Separate `VDATrustedSignerManager` contract from original `VDAVerificationContract`
- Make `VDAVerificationContract` extends the above `VDATrustedSignerManager`
- Update the extension of test files from ".ts" to ".test.ts"

2023-12-15 (v0.1.7)
-------------------
- Make `VDAVerificationContract` as abstract

2023-11-13 (v0.1.6)
-------------------
- Added `isTrustedSigner()` function

2023-05-10 (v0.1.5)
-------------------
- Update test code using `@verida/contract-test-utils`

2023-04-03 (v0.1.4)
-------------------
- Added events for `addTrustedSigner()` and `removeTrustedSigner()`

2023-03-24 (v0.1.3)
-------------------
- Solidity upgraded to '0.8.18'
- Hardhat configuration upgraded

2023-03-08 (v0.1.2)
-------------------
- Test code updated for on-chain verification test
- Added dependency for test - `@verida/types`


2023-02-15 (v0.1.1)
-------------------
- `addTrustedSigner()` function updated. Used `require` statement for gas efficiency.