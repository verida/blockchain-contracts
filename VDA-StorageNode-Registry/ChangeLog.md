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