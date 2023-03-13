# Version 0.0.X
## 0.0.1 - Initial Version

## 0.0.2 - 2023-3-8
- Updated the internal data structure
- Removed `msg.sender` in functions
- Updated the `generateProof()` function in the test/utils.ts. Used the updated the verida-js packages to create the signatures

`isSBTClaimed()` & `getClaimedSBTList()` functions were able to be called by the token owners only becuase these functions used the `msg.sender` inside the function to check who the caller. Now these functions are updated and anyone can call with parameters.