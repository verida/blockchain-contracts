2023-10-18 (v0.2.0)
-------------------
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