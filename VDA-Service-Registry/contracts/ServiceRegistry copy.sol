// SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./BytesLib.sol";
// import "./IServiceRegistry.sol";

contract ServiceRegistryCopy is OwnableUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using BytesLib for bytes;
    using SafeERC20 for IERC20;

    /**
     * Config variables
     * infraType => price
     * Price per account according to the infrastructure type
     */
    mapping (string => uint256) vdaPerAccount;
    /**
     * serviceType => infraType
     * Lookup between service type and infra type
     */ 
    mapping (string => string) typeLookup;

    /// 30 days = 2,592,000 s
    uint256 public deregisterDelayDays = 30;
    uint256 public minimumDaysCreditPerService = 30;
    uint256 public priceChangeDelayDays = 30;
    
    // --------------- State Variables ---------------
    // Verida Token
    IERC20 public vdaToken;
    
    /**
     * If Operator didn't claim in time, he cannot claim anymore.
     * Represent that amount
     */
    uint256 restTokens;

    /**
     * did => serviceId[] : did = vda infra operator
     */
    mapping (address => EnumerableSet.Bytes32Set) operatorServiceIdList;

    /**
     * serviceId => ServiceInfo
     */
    mapping (bytes32 => ServiceInfo) serviceInfos;

    /**
     * did => AccountInfo
     */
    mapping (address => uint256) creditAmount;

    EnumerableSet.Bytes32Set serviceIdList;
       

    /**
     * @dev Registered service detail
     * Operator will register services and accounts will use these services
     */
    struct ServiceDetail {
        address identity;
        string infraType;
        string serviceType;
        string endpointUri;
        string country;
        uint256 maxAccounts;
        uint256 pricePerDayPerAccount;
        uint256 startTime;
    }

    /**
     * @dev Register service info
     * Operator will register services
     * Represent the Registered service.
     * Operator can register only one service by type
     */
    struct ServiceInfo {
        ServiceDetail serviceDetail;
        uint256 creditAmount;
        uint256 expireTime;
        uint256 lastClaimTime;
        mapping (address => uint256) expireTimes;
        mapping (address => uint256) pricePerDays;
        EnumerableSet.AddressSet connectedAccounts;
        ServiceStatus status;
    }

    struct RegisterServiceInputParams {
        string serviceType;
        string endpointUri;
        string country;
        uint256 maxAccounts;
        uint256 pricePerDayPerAccount;
    }

    /// @dev Check if signature is signed by identity
    modifier onlyVerifiedSignature(address identity, bytes calldata signature) {
        require(identity != address(0), "Identity address cannot be zero");
        // require signature is signed by identity
        bytes memory rightSign = hex"67de2d20880a7d27b71cdcb38817ba95800ca82dff557cedd91b96aacb9062e80b9e0b8cb9614fd61ce364502349e9079c26abaa21890d7bc2f1f6c8ff77f6261c";
        require(signature.equal(rightSign), "bad_actor");
        _;
    }

    enum ServiceStatus {
        Active,
        Disabled,
        PendingUpdate,
        PendingRemoval
    }

    event RegisterService(bytes32 indexed serviceId, address indexed identity, string serviceName, string endpointUri, string country, uint256 maxAccounts, uint256 price);
    event UpdateService(bytes32 indexed serviceId, address indexed identity, uint256 maxAccounts, uint256 pricePerAccount, uint256 updateTime, uint256 expireTime);
    event DeregisterService(bytes32 indexed serviceId, address indexed identity, uint256 deregisterTime, uint256 expireTime);
    event AddCredit(address indexed identity, uint256 amount);
    event RemoveCredit(address indexed identity, uint256 amount);
    event ConnectService(address indexed identity, bytes32 indexed serviceId, uint256 connectTime);

    /**
     * Initializer of upgradeable contract
     */
    function initialize(address _vdaToken) public initializer {
        __Ownable_init();
        
        vdaPerAccount["database"] = 300;
        vdaPerAccount["messaging"] = 400;
        vdaPerAccount["notification"] = 150;
        vdaPerAccount["storage"] = 100;

        typeLookup["VeridaDatabase"] = "database";
        typeLookup["VeridaMessaging"] = "messaging";
        typeLookup["VeridaNotification"] = "notification";
        typeLookup["VeridaStorage"] = "storage";

        vdaToken = IERC20(_vdaToken);
    }

    function setToken(address _vdaToken) external onlyOwner() {
        vdaToken = IERC20(_vdaToken);
    }

    // Function to receive Ether. msg.data must be empty
    // receive() external payable {}

    // Fallback function is called when msg.data is not empty
    // fallback() external payable {}

    /**
     * @dev Account{identity} add credit to his account
     *
     * @param identity Represent the DID
     * @param numCredit Credit amount that will be added
     * @param signature Used to check if DID is signed by correct signature
     */
    function addCredit(
        address identity,
        uint256 numCredit,
        bytes calldata signature
    ) public onlyVerifiedSignature(identity, signature) {
        bool success = vdaToken.transferFrom(_msgSender(), address(this), numCredit);
        require(success, "Token transfer failed");

        creditAmount[identity] += numCredit;

        emit AddCredit(identity, numCredit);
    }

    /**
     * @dev Account{identity} remove credit from the account
     *
     * @param identity Represent the DID
     * @param numCredit Credit amount that will be removed
     * @param signature Used to check if DID is signed by correct signature
     */
    function removeCredit(
        address identity,
        uint256 numCredit,
        bytes calldata signature
    ) public onlyVerifiedSignature(identity, signature) {
        require(numCredit > 0, "Value cannot be zero");
        require(creditAmount[identity] >= numCredit, "Not enough credit to remove");

        bool success = vdaToken.transfer(_msgSender(), numCredit);
        require(success, "Token transfer failed");

        creditAmount[identity] -= numCredit;

        emit RemoveCredit(identity, numCredit);
    }

    /**
     * @dev Operator{identity} register new service
     * 
     * @param identity Represent the DID
     * @param inputParam Registering Service Input Params
     * @param signature Used to check if DID is signed by correct signature
     */
    function registerService(
        address identity,
        RegisterServiceInputParams calldata inputParam,
        // string calldata proof,
        bytes calldata signature) public onlyVerifiedSignature(identity, signature)
    {
        // Generate new serviceId from {DID} and {serviceType}
        bytes32 serviceId = keccak256(abi.encodePacked(identity, inputParam.serviceType));
        // Check if service has already registered
        bool isRegistered = operatorServiceIdList[identity].contains(serviceId);
        require(!isRegistered, "Service has already registered!");
        operatorServiceIdList[identity].add(serviceId);
        serviceIdList.add(serviceId);

        // Get infraType; ex, typeLookup["VeridaDatabase"] = "database"
        string memory infraType = typeLookup[inputParam.serviceType];
        uint256 registerPrice = inputParam.maxAccounts * vdaPerAccount[infraType];
        require(creditAmount[identity] >= registerPrice, "Not enough credit to register service");        
        creditAmount[identity] -= registerPrice;

        // Register new service
        ServiceInfo storage _service = serviceInfos[serviceId];
        _service.serviceDetail.identity = identity;
        _service.serviceDetail.infraType = infraType;
        _service.serviceDetail.serviceType = inputParam.serviceType;
        _service.serviceDetail.endpointUri = inputParam.endpointUri;
        _service.serviceDetail.country = inputParam.country;
        _service.serviceDetail.maxAccounts = inputParam.maxAccounts;
        _service.serviceDetail.pricePerDayPerAccount = inputParam.pricePerDayPerAccount;
        _service.serviceDetail.startTime = block.timestamp;
        _service.lastClaimTime = block.timestamp;
        _service.creditAmount = _service.creditAmount + registerPrice;
        _service.status = ServiceStatus.Active;

        emit RegisterService(serviceId, identity, serviceInfos[serviceId].serviceDetail.serviceType, serviceInfos[serviceId].serviceDetail.endpointUri, serviceInfos[serviceId].serviceDetail.country, serviceInfos[serviceId].serviceDetail.maxAccounts, serviceInfos[serviceId].serviceDetail.pricePerDayPerAccount);
    }

    /** 
     * @dev Operator{identity} update the Service{serviceId}
     * 
     * @param identity Represent the DID
     * @param serviceId ServiceId for update
     * @param maxAccounts Maximum number of accounts that can connect to the service
     * @param pricePerAccount price that account should pay per day
     * @param signature Used to check if DID is signed by correct signature
     */
    function updateService(
        address identity,
        bytes32 serviceId,
        uint256 maxAccounts,
        uint256 pricePerAccount,
        bytes calldata signature
    ) public onlyVerifiedSignature(identity, signature) {
        // // Get service from {serviceId}
        // ServiceInfo storage _service = serviceInfos[serviceId];
        // // Check if service updating time limit
        // require(block.timestamp > _service.expireTime, "Cannot update service due to limit to priceChangeDelayDays");
        // uint256 connectedCount = getConnectedAccountCount(serviceId);
        // // Cannot set maxAccounts less than number of connected accounts
        // require(maxAccounts > connectedCount, "Value can't be lower than the current number of connected accounts");
        // string memory infraType = typeLookup[_service.serviceDetail.serviceType];
        // if(_service.serviceDetail.maxAccounts > maxAccounts) {
        //     // Decrease maxAccounts, so Operator will receive the rest tokens
        //     uint256 price = (_service.serviceDetail.maxAccounts - maxAccounts) * vdaPerAccount[infraType];
        //     _service.creditAmount = _service.creditAmount - price;
        //     creditAmount[identity] += price;
        // } else if(_service.serviceDetail.maxAccounts < maxAccounts) {
        //     // Increase maxAccounts, so Operator will pay more tokens
        //     uint256 price = (maxAccounts - _service.serviceDetail.maxAccounts) * vdaPerAccount[infraType];
        //     _service.creditAmount = _service.creditAmount + price;
        //     creditAmount[identity] -= price;
        // }
        // // Update the service status
        // _service.serviceDetail.maxAccounts = maxAccounts;
        // _service.serviceDetail.pricePerDayPerAccount = pricePerAccount;
        // _service.expireTime = block.timestamp + priceChangeDelayDays * 1 days;
        // _service.status = ServiceStatus.PendingUpdate;

        // emit UpdateService(serviceId, identity, maxAccounts, pricePerAccount, block.timestamp, block.timestamp + priceChangeDelayDays * 1 days);
    }

    /**
     * @dev Operator{identity} deregister the Service{serviceId}
     * Only update the status of the service
     * 
     * @param identity Represent the DID
     * @param serviceId ServiceId for deregister
     * @param signature Used to check if DID is signed by correct signature
     */
    function deregisterService(
        address identity,
        bytes32 serviceId,
        bytes calldata signature
    ) public onlyVerifiedSignature(identity, signature) {
        bool isPending = serviceInfos[serviceId].status == ServiceStatus.PendingRemoval;
        // Check if service is already pending removal
        require(!isPending, "Service is pending removal");
        // Update service status only
        serviceInfos[serviceId].status = ServiceStatus.PendingRemoval;
        serviceInfos[serviceId].expireTime = block.timestamp + deregisterDelayDays * 1 days;

        emit DeregisterService(serviceId, identity, block.timestamp, block.timestamp + deregisterDelayDays * 1 days);
    }

    /**
     * @dev Operator will remove service from the list
     * 
     * @param identity Represent the DID
     * @param serviceId ServiceId that will be removed
     * @param signature Used to check if DID is signed by correct signature
     */
    function removeService(
        address identity,
        bytes32 serviceId,
        bytes calldata signature
    ) external onlyVerifiedSignature(identity, signature) {
        // Remove service from the storage according the status
        ServiceInfo storage _service = serviceInfos[serviceId];
        require((serviceInfos[serviceId].status == ServiceStatus.PendingRemoval) && (block.timestamp > serviceInfos[serviceId].expireTime), "Not ready to remove");
        creditAmount[identity] += _service.creditAmount;
        delete serviceInfos[serviceId];
        operatorServiceIdList[identity].remove(serviceId);
        serviceIdList.remove(serviceId);
    }

    /** 
     * @dev Account{identity} connect to the Service{serviceId}
     *
     * @param identity Represent the DID
     * @param serviceId Account will connect to this serviceId
     * @param signature Used to check if DID is signed by correct signature
     */
    function connectService(
        address identity,
        bytes32 serviceId,
        bytes calldata signature
    ) public onlyVerifiedSignature(identity, signature) {
        ServiceInfo storage _service = serviceInfos[serviceId];
        bool isPendingRemoval = _service.status == ServiceStatus.PendingRemoval;
        // Check the service status
        require(!isPendingRemoval, "Service is pending removal");
        require(!_service.connectedAccounts.contains(identity), "Already connected");
        require(_service.serviceDetail.maxAccounts > _service.connectedAccounts.length(), "Service hits maximum number of connected accounts");

        // Account bond tokens to connect service
        uint256 price = _service.serviceDetail.pricePerDayPerAccount * minimumDaysCreditPerService;
        require(creditAmount[identity] >= price, "Not enough VDA to connect service");
        creditAmount[identity] -= price;

        _service.expireTimes[identity] = block.timestamp + minimumDaysCreditPerService * 1 days;
        _service.pricePerDays[identity] = _service.serviceDetail.pricePerDayPerAccount;
        _service.creditAmount = _service.creditAmount + price;
        _service.connectedAccounts.add(identity);

        emit ConnectService(identity, serviceId, block.timestamp);
    }

    /**
     * @dev Account{identity} disconnect from the Service{serviceId}
     *
     * @param identity Represent the DID
     * @param serviceId Account will disconnect from the serviceId
     * @param signature Used to check if DID is signed by correct signature
     */
    function disconnectService(
        address identity,
        bytes32 serviceId,
        bytes calldata signature
    ) public onlyVerifiedSignature(identity, signature) {
        // Check if account is connected to the service
        bool isConnected = serviceInfos[serviceId].connectedAccounts.contains(identity);
        require(isConnected, "Account is not connected to service");
        ServiceInfo storage _service = serviceInfos[serviceId];
        // Account will receive the remained tokens
        uint256 price = _service.pricePerDays[identity] * calcDays(block.timestamp, serviceInfos[serviceId].expireTimes[identity]);
        creditAmount[identity] += price;
        _service.creditAmount = _service.creditAmount - price;
        delete _service.expireTimes[identity];
        delete _service.pricePerDays[identity];
        _service.connectedAccounts.remove(identity);
    }

    /**
     * @dev Discover the available services so accounts can select services
     * 
     * @param infraType Serach filter for Infrastructure type
     * @param serviceType Serach filter for Service type
     * @param country Serach filter for country
     * @param maxPricePerDay Serach filter for maxPricePerDay
     * @return serviceIds
     */
    function discoverServices(
        string memory infraType,
        string memory serviceType,
        string memory country,
        uint256 maxPricePerDay
    ) external view returns(bytes32[] memory) {
        bytes32[] memory serviceIds = new bytes32[](serviceIdList.length());
        uint cnt = 0;
        for(uint i = 0;i<serviceIdList.length();i++) {
            bytes32 _id = serviceIdList.at(i);
            ServiceDetail memory _detail = serviceInfos[_id].serviceDetail;
            if((compareStrings(_detail.infraType, infraType) || compareStrings(infraType, "")) &&
               (compareStrings(_detail.serviceType, serviceType) || compareStrings(serviceType, "")) &&
               (compareStrings(_detail.country, country) || compareStrings(country, "")) &&
               ( maxPricePerDay == 0 || _detail.pricePerDayPerAccount <= maxPricePerDay)
            ) {
                serviceIds[cnt] = _id;
                cnt = cnt + 1;
            }
        }
        bytes32[] memory res = new bytes32[](cnt);
        for(uint i = 0;i<cnt;i++)
            res[i] = serviceIds[i];
        return res;
    }

    function compareStrings(string memory a, string memory b) internal pure returns(bool) {
        return (keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b)));
    }

    /**
     * @dev Verida Infrastructure Operator will call this function every week.
     *
     * @param identity Represent the DID
     * @param serviceId Operator will claim tokens for this service
     * @param signature Used to check if DID is signed by correct signature
     */
    function claim(
        address identity,
        bytes32 serviceId,
        bytes calldata signature
    ) public onlyVerifiedSignature(identity, signature) {
        ServiceInfo storage _service = serviceInfos[serviceId];
        // Check the 7 days limit to claim
        require(block.timestamp >= _service.lastClaimTime + 7 days, "Should claim after 7 days from the last claim");
        uint256 amount = 0;
        uint256 currentTime = block.timestamp;
        // Calculate the claimable tokens from connected accounts
        for(uint i = 0;i<_service.connectedAccounts.length();i++){
            address _did = _service.connectedAccounts.at(i);
            uint256 conTime = _service.expireTimes[_did] - minimumDaysCreditPerService * 1 days;
            uint256 sTime = _service.lastClaimTime;
            uint256 eTime = currentTime;
            if(conTime > _service.lastClaimTime) 
                sTime = conTime;
            if(currentTime > _service.expireTimes[_did])
                eTime = _service.expireTimes[_did];
            amount = amount + _service.pricePerDays[_did] * calcDays(sTime, eTime);
        }
        require(_service.creditAmount >= amount, "Cannot claim, not enough credit");
        _service.creditAmount = _service.creditAmount - amount;
        // If Operator tries to claim after 14 days, the tokens will be stored in the contract and he cannot claim that tokens.
        if(currentTime <= _service.lastClaimTime + 14 days) {
            creditAmount[identity] += amount;
        } else {
            restTokens = restTokens + amount;
        }
        _service.lastClaimTime = currentTime;
    }

    // function checkServiceAvailability(address identity, bytes32 serviceId) public view returns(bool) {
    modifier checkServiceAvailability(address identity, bytes32 serviceId) {
        bool isTimeLimited = block.timestamp > serviceInfos[serviceId].expireTimes[identity];
        bool isConnected = serviceInfos[serviceId].connectedAccounts.contains(identity);
        require(!isTimeLimited && isConnected, "Unable to use service");
        _;
    }

    /**
     * @dev Get service IDs created by DID
     *
     * @param identity Represent the DID (Operator)
     * @return serviceIds Created by {identity}
     */
    function getRegisteredIds(address identity) external view returns(bytes32[] memory) {
        uint256 length = operatorServiceIdList[identity].length();

        if(length == 0){
            bytes32[] memory emptyAry = new bytes32[](0);
            return emptyAry;
        }

        bytes32[] memory serviceIds = new bytes32[](length);
        for(uint i = 0;i<length;i++) {
            serviceIds[i] = operatorServiceIdList[identity].at(i);
        }

        return serviceIds;
    }
    
    /**
     * @dev Get detail of the Service{serviceId}
     *
     * @param serviceId Service id
     * @return identity Service detail by {serviceId}
     */
    function getServiceDetail(bytes32 serviceId) public view returns(
        address identity,
        string memory infraType,
        string memory serviceType,
        string memory endpointUri,
        string memory country,
        uint256 maxAccounts,
        uint256 pricePerDayPerAccount,
        uint256 startTime
    ) {
        identity = serviceInfos[serviceId].serviceDetail.identity;
        infraType = serviceInfos[serviceId].serviceDetail.infraType;
        serviceType = serviceInfos[serviceId].serviceDetail.serviceType;
        endpointUri = serviceInfos[serviceId].serviceDetail.endpointUri;
        country = serviceInfos[serviceId].serviceDetail.country;
        maxAccounts = serviceInfos[serviceId].serviceDetail.maxAccounts;
        pricePerDayPerAccount = serviceInfos[serviceId].serviceDetail.pricePerDayPerAccount;
        startTime = serviceInfos[serviceId].serviceDetail.startTime;
    }

    /**
     * @dev Get credit amount of Service{serviceId}
     *
     * @param serviceId Service id
     * @return credit Service credit amount
     */
    function getServiceCredit(bytes32 serviceId) external view returns (uint256 credit) {
        credit = serviceInfos[serviceId].creditAmount;
    }

    /**
     * @dev Get status of Service{serviceId}
     *
     * @param serviceId Service id
     * @return status Service status
     */
    function getServiceStatus(bytes32 serviceId) external view returns (ServiceStatus status) {
        status = serviceInfos[serviceId].status;
    }

    /**
     * @dev Get number of connected accounts to the Service{serviceId}
     *
     * @param serviceId Service id
     * @return count Get number of connected accounts to the service
     */
    function getConnectedAccountCount(bytes32 serviceId) public view returns(uint256 count) {
        count = serviceInfos[serviceId].connectedAccounts.length();
    }

    /**
     * @dev Get list of connected accounts to the Service{serviceId}
     *
     * @param serviceId Service id
     * @return accounts Get connected accounts list to the service
     */
    function getConnectedAccounts(bytes32 serviceId) public view returns(address[] memory) {
        uint256 length = serviceInfos[serviceId].connectedAccounts.length();
        if(length == 0) {
            address[] memory emptyAry = new address[](0);
            return emptyAry;
        }
        address[] memory accounts = new address[](length);
        for(uint i = 0;i<length;i++){
            accounts[i] = serviceInfos[serviceId].connectedAccounts.at(i);
        }
        return accounts;
    }

    /**
     * @dev Get credit amount of Account{identity}
     *
     * @param identity Represent the DID
     * @return credit Get account credit
     */
    function getAccountCredit(address identity) external view returns(uint256 credit) {
        credit = creditAmount[identity];
    }

    /// Set & Get Config variables
    function getVdaPerAccount(string memory infraType) external view returns(uint256) {
        return vdaPerAccount[infraType];
    }

    function setVdaPerAccount(string memory infraType, uint256 amount) external onlyOwner {
        vdaPerAccount[infraType] = amount;
    }

    function getTypeLookup(string memory serviceType) external view returns(string memory) {
        return typeLookup[serviceType];
    }

    function setTypeLookup(string memory serviceType, string memory infraType) external onlyOwner {
        typeLookup[serviceType] = infraType;
    }
    
    function setDeregisterDelayDays(uint256 delay) external onlyOwner {
        deregisterDelayDays = delay;
    }

    function setMinimumDaysCreditPerService(uint256 minDays) external onlyOwner {
        minimumDaysCreditPerService = minDays;
    }

    function setPriceChangeDelayDays(uint256 delay) external onlyOwner {
        priceChangeDelayDays = delay;
    }

    /**
     * @dev Calculate number of days between {startTime} and {endTime}
     */
    function calcDays(uint256 startTime, uint256 endTime) internal pure returns(uint256) {
        if(endTime <= startTime)
            return 0;
        return (endTime - startTime) / 3600 / 24;
    }
}