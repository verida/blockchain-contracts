# Version 0.0
## 0.0.1 - Initial Version

# Version 0.1 : 2023/2/15
## 0.1.0 - Inherit VDA-Verification-Base contract
- Add dependency to the @verida/vda-verification-contract - VDA-Verification-Base contract<br>
Now the **VDARewardContract** inherits the **VDAVerificationContract** contract.
- Removed ReworkdToken.sol from the "contracts" folder. Instead, link it as a dependency. Used in the test code.
## 0.1.1 - Update reward token to Verida token
- Now using the @verida/erc20-contract as a reward token