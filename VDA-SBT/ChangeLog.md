# Version 0.0.X
## 0.0.1 - Initial Version

## 0.0.2 - 2023-3-8
- Updated the internal data structure
- Removed `msg.sender` in functions
- Updated the `generateProof()` function in the test/utils.ts. Used the updated the verida-js packages to create the signatures

`isSBTClaimed()` & `getClaimedSBTList()` functions were able to be called by the token owners only becuase these functions used the `msg.sender` inside the function to check who the caller. Now these functions are updated and anyone can call with parameters.

# 0.1
## 0.1.0 - 2023-3-13
- A user can have only one SBT per SBT type. For example, when a user has 2 twitter accounts, he can't have SBTs for these 2 accounts on the same wallet. A SBT for twitter can exist only one on a wallet.