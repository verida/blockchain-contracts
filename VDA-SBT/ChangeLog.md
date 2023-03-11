2023-3-8 (v0.0.2)
-----------------

- Updated the internal data structure
- Removed `msg.sender` in functions
- Updated the `generateProof()` function in the test/utils.ts. Used the updated the verida-js packages to create the signatures
- `isSBTClaimed()` & `getClaimedSBTList()` functions were able to be called by the token owners only because these functions used the `msg.sender` inside the function to check who the caller. Now these functions are updated and anyone can call with parameters

(v0.0.1)
-----------------

- Initial version