// SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./BytesLib.sol";
// import "./IServiceRegistry.sol";

contract ServiceRegistry is OwnableUpgradeable {
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
    uint256 public deregisterDelayDays;
    uint256 public minimumDaysCreditPerService;
    uint256 public priceChangeDelayDays;

    // once per 7 days
    uint256 public claimIntervalMin; 
    // Need to claim before 14 days
    uint256 public claimIntervalLimit;
    
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
     * service registered info of a user
     */
    mapping (address => mapping(bytes32 => UserInfo)) userInfoList;

    /**
     * serviceId => ServiceInfo
     */
    mapping (bytes32 => ServiceInfo) serviceInfoList;

    /**
     * did => AccountInfo
     */
    mapping (address => uint256) creditAmount;

    EnumerableSet.Bytes32Set serviceIdList;

    /**
     * serviceId => Service
     */
    struct ServiceInfo {
        address operator;

        string serviceType;
        string endpointUri;
        string country;

        uint256 maxAccounts;
        uint256 price;

        uint256 registerCreditAmount; //Deposited to register

        uint256 userCreditAmount; //Locked amount by users
        uint256 lastClaimTime;

        uint256 updatePrice;
        uint256 updatePriceTime;

        uint256 expireTime; // deregistered time

        EnumerableSet.AddressSet connectedAccounts;
    }

    /**
     * did => serviceId => User
     */
    struct UserInfo {
        uint256 startTime;
        uint256 daysForRegister;
        uint256 registerPrice;

        uint256 unpaidToOperator;
        uint256 unpaidToVerida;
    }

    struct ServiceLackingCredit {
        bytes32 serviceId;
        uint256 lackingAmount;
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

    modifier onlyServiceOperator(address identity, bytes32 serviceId) {
        require(serviceIdList.contains(serviceId), "Unknown Service");
        ServiceInfo storage serviceInfo = serviceInfoList[serviceId];
        require(identity == serviceInfo.operator, "Not a service operator");
        _;
    }


    enum ServiceStatus {
        Active,
        Disabled,
        PendingUpdate,
        PendingRemoval
    }

    event RegisterService(bytes32 indexed serviceId, address indexed identity, string serviceName, string endpointUri, string country, uint256 maxAccounts, uint256 price);
    event UpdateServiceMaxAccount(bytes32 indexed serviceId, address indexed identity, uint256 maxAccounts);
    event UpdateServicePrice(bytes32 indexed serviceId, address indexed identity, uint256 pricePerAccount, uint256 requestedTime, uint256 updateTime);
    event DeregisterService(bytes32 indexed serviceId, address indexed identity, uint256 deregisterTime, uint256 expireTime);
    event RemoveService(bytes32 indexed serviceId, address indexed identity, uint256 time);
    event AddCredit(address indexed identity, uint256 amount);
    event RemoveCredit(address indexed identity, uint256 amount);
    event ConnectService(address indexed identity, bytes32 indexed serviceId, uint256 connectTime);
    event DisconnectService(address indexed identity, bytes32 indexed serviceId, uint256 disconnectTime);

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

        deregisterDelayDays = 30;
        minimumDaysCreditPerService = 30;
        priceChangeDelayDays = 30;

        claimIntervalMin = 7;
        claimIntervalLimit = 14;
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

        creditAmount[identity] -= numCredit;

        bool success = vdaToken.transfer(_msgSender(), numCredit);
        require(success, "Token transfer failed");

        emit RemoveCredit(identity, numCredit);
    }

    /**
     * @notice get lacking amount of a service
     * @dev Internal function. Only call after service operator & serviceId checked.
     * @param serviceId - service id
     * @return lackingAmount - lacking amount
     */
    function _getServiceLackingCredit(
        bytes32 serviceId
    ) internal view returns (uint256 lackingAmount)
    {
        ServiceInfo storage serviceInfo = serviceInfoList[serviceId];

        string storage infuraType = typeLookup[serviceInfo.serviceType];
        uint256 needCredit = vdaPerAccount[infuraType] * serviceInfo.maxAccounts;

        lackingAmount = serviceInfo.registerCreditAmount  >= needCredit ? 
            0 : (needCredit - serviceInfo.registerCreditAmount);
    }

    /**
     * @notice get lacking amount of a service
     * @dev Public function. Call internal function after service operator check
     * @param identity Verida did of a service operator
     * @param serviceId service id
     * @param signature Used to check if DID is signed by correct signature
     * @return lackingAmount - lacking amount
     */
    function getServiceLackingCredit(
        address identity,
        bytes32 serviceId,
        bytes calldata signature
    ) public view onlyVerifiedSignature(identity, signature) onlyServiceOperator(identity, serviceId) 
        returns (uint256 lackingAmount)
    {
        lackingAmount = _getServiceLackingCredit(serviceId);
    }

    /**
     * @notice Get all lacking amount list for an service operator
     * @dev Called after check transaction signature & etc.
     * @param identity Verida did of a service operator
     */
    function _getServiceLackingCreditList(
        address identity
    ) internal view returns (
        uint256 totalLackingAmount, 
        ServiceLackingCredit[] memory lackingAmountList) {
        
        EnumerableSet.Bytes32Set storage serviceList = operatorServiceIdList[identity];

        totalLackingAmount = 0;
        lackingAmountList = new ServiceLackingCredit[](serviceList.length());

        uint256 lackingAmount;
        for (uint256 i = 0; i < serviceList.length(); i++) {
            lackingAmount = _getServiceLackingCredit(serviceList.at(i));
            lackingAmountList[i].serviceId = serviceList.at(i);
            lackingAmountList[i].lackingAmount = lackingAmount;
            totalLackingAmount += lackingAmount;
        }
    }

    /**
     * @notice Get all lacking amount list for an service operator
     * @param identity Verida did of a service operator
     * @param signature Used to check if DID is signed by correct signature
     */
    function getServiceLackingCreditList(
        address identity,
        bytes calldata signature
    ) public view onlyVerifiedSignature(identity, signature) returns (
        uint256 totalLackingAmount, 
        ServiceLackingCredit[] memory lackingAmountList) {

        (totalLackingAmount, lackingAmountList) = _getServiceLackingCreditList(identity);
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
        ServiceInfo storage serviceInfo = serviceInfoList[serviceId];
        serviceInfo.operator = identity;
        serviceInfo.serviceType = inputParam.serviceType;
        serviceInfo.endpointUri = inputParam.endpointUri;
        serviceInfo.country = inputParam.country;
        serviceInfo.maxAccounts = inputParam.maxAccounts;
        serviceInfo.price = inputParam.pricePerDayPerAccount;
        serviceInfo.lastClaimTime = block.timestamp;

        serviceInfo.registerCreditAmount = registerPrice;
        
        emit RegisterService(
            serviceId, 
            identity, 
            serviceInfo.serviceType, 
            serviceInfo.endpointUri, 
            serviceInfo.country, 
            serviceInfo.maxAccounts, 
            serviceInfo.price);
    }

    /**
     * @notice Update credits when operator update his service
     * @dev Only call this function after signature & operator owenr checked
     * @param identity Operator DID
     * @param amount Amount to update
     */
    function _updateOperatorCredit(address identity, int256 amount) internal {
        if (amount > 0) {
            creditAmount[identity] += uint256(amount);
        } else {
            amount = -amount;
            require(creditAmount[identity] >= uint256(amount), "Not enough credit");
            creditAmount[identity] -= uint256(amount);
        }
    }

    /**
     * @notice Check whether operator is restricted by lacking credits
     * @param identity Operator DID
     */
    function _checkOperatorRestricted(address identity) internal view {
        uint256 totalLackingAmount;
        (totalLackingAmount,) = _getServiceLackingCreditList(identity);
        require(totalLackingAmount == 0, "Operator under lacking credits");
    }

    /**
     * @notice Check service update is available
     * @dev This is used for updating 'pricePerDayPerAccount' & 'maxAccounts'
     * @param identity Service operator DID
     * @param serviceId Service ID
     */
    function _checkServiceUpdateable(address identity, bytes32 serviceId) internal view {
        ServiceStatus status = getServiceStatus(serviceId);
        require(status != ServiceStatus.Disabled, "Service disabled");
        require(status != ServiceStatus.PendingRemoval, "Service is pending removal");
        require(status != ServiceStatus.PendingUpdate, "Service is pending update");

        _checkOperatorRestricted(identity);
        // require(_getServiceLackingCredit(serviceId) == 0, "Service under lacking credits");
    }

    /**
     * @notice Update maxAccounts of a service
     * @dev Only the service operator can call this
     * @param identity Represent the DID
     * @param serviceId ServiceId for update
     * @param maxAccounts Maximum number of accounts that can connect to the service
     * @param signature Used to check if DID is signed by correct signature
     */
    function updateServiceMaxAccounts(
        address identity,
        bytes32 serviceId,
        uint256 maxAccounts,
        bytes calldata signature
    ) public onlyVerifiedSignature(identity, signature) 
        onlyServiceOperator(identity, serviceId) 
    {
        _checkServiceUpdateable(identity, serviceId);

        ServiceInfo storage serviceInfo = serviceInfoList[serviceId];
        
        // uint256 connectedCount = getConnectedAccountCount(serviceId);
        require(maxAccounts >= getConnectedAccountCount(serviceId), "Value less than connected accounts");

        uint256 necessaryCredit;
        {
            string memory infraType = typeLookup[serviceInfo.serviceType];
            necessaryCredit = vdaPerAccount[infraType] * maxAccounts;
        }

        _updateOperatorCredit(identity, int256(necessaryCredit) - int256(serviceInfo.registerCreditAmount));
        
        serviceInfo.maxAccounts = maxAccounts;
        serviceInfo.registerCreditAmount = necessaryCredit;

        emit UpdateServiceMaxAccount(
            serviceId, 
            identity, 
            maxAccounts
        );
    }

    /**
     * @notice Update pricePerAccount of a service
     * @dev Only the service operator can call this
     * @param identity Represent the DID
     * @param serviceId ServiceId for update
     * @param pricePerAccount price that account should pay per day
     * @param signature Used to check if DID is signed by correct signature
     */
    function updateServicePrice(
        address identity,
        bytes32 serviceId,
        uint256 pricePerAccount,
        bytes calldata signature
    ) public onlyVerifiedSignature(identity, signature) 
        onlyServiceOperator(identity, serviceId)
    {
        _checkServiceUpdateable(identity, serviceId);

        ServiceInfo storage serviceInfo = serviceInfoList[serviceId];
        
        // Service requested to update but price not updated yet
        if (serviceInfo.updatePriceTime != 0 && serviceInfo.price != serviceInfo.updatePrice) {
            serviceInfo.price = serviceInfo.updatePrice;
        }

        serviceInfo.updatePrice = pricePerAccount;
        serviceInfo.updatePriceTime = block.timestamp + priceChangeDelayDays * 1 days;
        emit UpdateServicePrice(
            serviceId, 
            identity, 
            pricePerAccount, 
            block.timestamp, 
            serviceInfo.updatePriceTime
        );
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
    ) public onlyVerifiedSignature(identity, signature) onlyServiceOperator(identity, serviceId) {
        ServiceStatus status = getServiceStatus(serviceId);
        require(status != ServiceStatus.Disabled, "Already deregistered");
        require(status != ServiceStatus.PendingRemoval, "Already in removal status");

        _checkOperatorRestricted(identity);

        ServiceInfo storage serviceInfo = serviceInfoList[serviceId];
        serviceInfo.expireTime = block.timestamp + deregisterDelayDays * 1 days;

        if (serviceInfo.expireTime <= serviceInfo.updatePriceTime) {
            serviceInfo.updatePrice = 0;
            serviceInfo.updatePriceTime = 0;
        }

        emit DeregisterService(serviceId, identity, block.timestamp, block.timestamp + deregisterDelayDays * 1 days);
    }

    /**
     * @notice service operator claim credits from users
     * @dev Only call this function after check transactio verification & 
        and service owner check
     * @param serviceId service id
     * @param claimDay last day of claim
     */
    function _claimService(bytes32 serviceId, uint256 claimDay) internal {
        require(claimDay <= block.timestamp, "Invalid claim day");

        ServiceInfo storage serviceInfo = serviceInfoList[serviceId];
        uint userCount = serviceInfo.connectedAccounts.length();

        uint payDays = _calcDays(serviceInfo.lastClaimTime, block.timestamp);
        uint payAmount = _getServicePrice(serviceId) * payDays;

        address userId;

        for (uint i = 0; i < userCount; i++) {
            userId = serviceInfo.connectedAccounts.at(i);
            UserInfo storage userInfo = userInfoList[userId][serviceId];
            // Cancel for users who is spending locked credits at connection time.
            if (claimDay < (userInfo.startTime * userInfo.daysForRegister * 1 days)) {
                continue;
            }

            // If claim day is after 14 days from previous claim, 
            // claim amount will go to Verida instead of operator
            if (payDays >= claimIntervalLimit) {
                userInfo.unpaidToVerida += payAmount;
            } else {
                userInfo.unpaidToOperator += payAmount;
            }

            if (creditAmount[userId] == 0) {
                continue;
            }
            
            // Process unpaind amounts of user
            if (creditAmount[userId] >= userInfo.unpaidToOperator) {
                // Process unpaid amounts to operator. Pay to service
                creditAmount[userId] -= userInfo.unpaidToOperator;
                serviceInfo.userCreditAmount += userInfo.unpaidToOperator;
                userInfo.unpaidToOperator = 0;

                // Process unpaid amounts to verida, Owned to contract
                if (creditAmount[userId] >= userInfo.unpaidToVerida) {
                    creditAmount[userId] -= userInfo.unpaidToVerida;
                    userInfo.unpaidToVerida = 0;
                } else {
                    userInfo.unpaidToVerida -= creditAmount[userId];
                    creditAmount[userId] = 0;
                }
            } else {
                // Pay to service
                serviceInfo.userCreditAmount += creditAmount[userId];
                userInfo.unpaidToOperator -= creditAmount[userId];
                creditAmount[userId] = 0;
            }            
        }

        // Update claim time. Keep remainig time duration that is less than 1 day
        serviceInfo.lastClaimTime += payDays * 1 days;
    }

    /**
     * @notice Get service price
     * @dev //This function will update price to new if there is a pending
     * @param serviceId - service Id
     * @return uint256 - price vale per account
     */
    function _getServicePrice(
        bytes32 serviceId
    ) internal view returns(uint256) {
        ServiceInfo storage serviceInfo = serviceInfoList[serviceId];
        ServiceStatus status = getServiceStatus(serviceId);
        
        if (status == ServiceStatus.PendingUpdate) {
            return serviceInfo.price;
        }

        if (serviceInfo.updatePriceTime != 0) {
            return serviceInfo.updatePriceTime;
        }

        return serviceInfo.price;

        // Alex: Check this again
        // if (serviceInfo.updatePriceTime != 0) {
        //     // Automatically update price to new
        //     if (serviceInfo.price != serviceInfo.updatePrice) {
        //         serviceInfo.price = serviceInfo.updatePrice;
        //     }
        //     serviceInfo.updatePrice = 0;
        //     serviceInfo.updatePriceTime = 0;
        // }
        // return serviceInfo.price;
    }

    /**
     * @notice diconnect user from a service. Return credits if user didn't user service for 'minimumDaysCreditService' days
     * @dev Only call this function after check wheter user is connected to service
     * Security check : disconnectTime > service expireTime
     * @param identity User DID
     * @param serviceId service hash
     * @param disconnectTime Requesting time
     */
    function _disconnectUserFromService(
        address identity,
        bytes32 serviceId,
        uint256 disconnectTime
    ) internal {
        ServiceInfo storage serviceInfo = serviceInfoList[serviceId];

        UserInfo storage userInfo = userInfoList[identity][serviceId];
        if (disconnectTime < (userInfo.startTime * userInfo.daysForRegister * 1 days)) {
            uint daysToSend = _calcDays(disconnectTime, userInfo.startTime * userInfo.daysForRegister * 1 days);
            uint sendAmount = userInfo.registerPrice * daysToSend;

            creditAmount[identity] += sendAmount;
            serviceInfo.userCreditAmount -= sendAmount;
        }
        delete userInfoList[identity][serviceId];

        serviceInfo.connectedAccounts.remove(identity);
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
    ) external onlyVerifiedSignature(identity, signature) onlyServiceOperator(identity, serviceId) {
        {
            ServiceStatus status = getServiceStatus(serviceId);
            require(status == ServiceStatus.Disabled, "Not deregistered");

            // Check lacking amount
            require(_getServiceLackingCredit(serviceId) == 0, "Service in lacking credit");
        }

        ServiceInfo storage serviceInfo = serviceInfoList[serviceId];

        _claimService(serviceId, serviceInfo.expireTime);

        {
            uint userCount = serviceInfo.connectedAccounts.length();
            address userId;

            for (uint i = 0; i < userCount; i++) {
                userId = serviceInfo.connectedAccounts.at(i);
                _disconnectUserFromService(userId, serviceId, serviceInfo.expireTime);
            }
        }
                
        creditAmount[identity] += serviceInfo.registerCreditAmount;
        creditAmount[identity] += serviceInfo.userCreditAmount;

        delete serviceInfoList[serviceId];
        operatorServiceIdList[identity].remove(serviceId);
        serviceIdList.remove(serviceId);

        emit RemoveService(serviceId, identity, block.timestamp);
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
        ServiceStatus status = getServiceStatus(serviceId);
        require(status != ServiceStatus.Disabled, "Disabled service");
        require(status != ServiceStatus.PendingRemoval, "Service is pending removal");

        require(_getServiceLackingCredit(serviceId) == 0, "Service under lacking credits");

        ServiceInfo storage serviceInfo = serviceInfoList[serviceId];
        require(!serviceInfo.connectedAccounts.contains(identity), "Already connected");
        require(serviceInfo.maxAccounts > serviceInfo.connectedAccounts.length(), "Max amount limited");

        uint256 servicePrice = _getServicePrice(serviceId);
        uint256 registerPrice = servicePrice * minimumDaysCreditPerService;
        require(creditAmount[identity] >= registerPrice, "Not enough credit");
        creditAmount[identity] -= registerPrice;

        UserInfo storage userInfo = userInfoList[identity][serviceId];
        userInfo.startTime = block.timestamp;
        userInfo.daysForRegister = minimumDaysCreditPerService;
        userInfo.registerPrice = servicePrice;
        userInfo.unpaidToOperator = 0;
        userInfo.unpaidToVerida = 0;
       
        serviceInfo.userCreditAmount += registerPrice;
        serviceInfo.connectedAccounts.add(identity);

        emit ConnectService(identity, serviceId, block.timestamp);
    }

    // /**
    //  * @dev Account{identity} disconnect from the Service{serviceId}
    //  *
    //  * @param identity Represent the DID
    //  * @param serviceId Account will disconnect from the serviceId
    //  * @param signature Used to check if DID is signed by correct signature
    //  */
    // function disconnectService(
    //     address identity,
    //     bytes32 serviceId,
    //     bytes calldata signature
    // ) public onlyVerifiedSignature(identity, signature) {
    //     ServiceInfo storage serviceInfo = serviceInfoList[serviceId];
        
    //     ServiceStatus status = getServiceStatus(serviceId);
    //     require(status != ServiceStatus.Disabled, "Deregistered service");

    //     // Check if account is connected to the service
    //     require(serviceInfo.connectedAccounts.contains(identity), "Not connected to service");

    //     _disconnectUserFromService(identity, serviceId, block.timestamp);

    //     emit DisconnectService(identity, serviceId, block.timestamp);
    // }

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
            ServiceInfo storage serviceInfo = serviceInfoList[_id];
            if((compareStrings(infraType, "") || compareStrings(typeLookup[serviceInfo.serviceType], infraType)) &&
               (compareStrings(serviceType, "") || compareStrings(serviceInfo.serviceType, serviceType)) &&
               (compareStrings(country, "") || compareStrings(serviceInfo.country, country)) &&
               ( maxPricePerDay == 0 || _getServicePrice(_id) <= maxPricePerDay)
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
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
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
    ) public onlyVerifiedSignature(identity, signature) onlyServiceOperator(identity, serviceId) {

        // Check service operator is in lacking status
        _checkOperatorRestricted(identity);        

        ServiceInfo storage serviceInfo = serviceInfoList[serviceId];
        require(block.timestamp >= serviceInfo.lastClaimTime + claimIntervalMin * 1 days, 
            abi.encodePacked("Available after ", claimIntervalMin, "days from the last claim"));

        _claimService(serviceId, block.timestamp);
    }

    // // function checkServiceAvailability(address identity, bytes32 serviceId) public view returns(bool) {
    // modifier checkServiceAvailability(address identity, bytes32 serviceId) {
    //     bool isTimeLimited = block.timestamp > serviceInfoList[serviceId].expireTimes[identity];
    //     bool isConnected = serviceInfoList[serviceId].connectedAccounts.contains(identity);
    //     require(!isTimeLimited && isConnected, "Unable to use service");
    //     _;
    // }

    /**
     * @dev Get service IDs created by DID
     *
     * @param identity Represent the DID (Operator)
     * @return serviceIds Created by {identity}
     */
    function getRegisteredIds(address identity) external view returns(bytes32[] memory) {
        uint256 length = operatorServiceIdList[identity].length();

        // if(length == 0){
        //     bytes32[] memory emptyAry = new bytes32[](0);
        //     return emptyAry;
        // }

        bytes32[] memory serviceIds = new bytes32[](length);
        for(uint i = 0;i<length;i++) {
            serviceIds[i] = operatorServiceIdList[identity].at(i);
        }

        return serviceIds;
    }
    
    /**
     * @dev Get detail of the Service{serviceId}
     * @param serviceId Service id
     * @return infraType Infra type of service type
     * @return serviceType Service type
     * @return endpointUri Service endpoint uri
     * @return country Service country
     * @return maxAccounts Max accounts number of service
     * @return pricePerDayPerAccount Service price
     */
    function getServiceDetail(bytes32 serviceId) public view returns(
        string memory infraType,
        string memory serviceType,
        string memory endpointUri,
        string memory country,
        uint256 maxAccounts,
        uint256 pricePerDayPerAccount
    ) {
        ServiceInfo storage serviceInfo = serviceInfoList[serviceId];
        infraType = typeLookup[serviceInfo.serviceType];
        serviceType = serviceInfo.serviceType;
        endpointUri = serviceInfo.endpointUri;
        country = serviceInfo.country;
        maxAccounts = serviceInfo.maxAccounts;
        pricePerDayPerAccount = _getServicePrice(serviceId);
    }

    /**
     * @dev Get credit amount of Service{serviceId}
     *
     * @param serviceId Service id
     * @return credit Service credit amount
     */
    function getServiceCredit(bytes32 serviceId) external view returns (uint256 credit) {
        credit = serviceInfoList[serviceId].userCreditAmount;
    }

    /**
     * @dev Get status of Service{serviceId}
     *
     * @param serviceId Service id
     * @return status Service status
     */
    function getServiceStatus(bytes32 serviceId) public view returns (ServiceStatus status) {
        require(serviceIdList.contains(serviceId), "Unknown service");
        ServiceInfo storage info = serviceInfoList[serviceId];

        uint256 curTime = block.timestamp;
        if (info.expireTime != 0) {
            status = curTime >= info.expireTime ? ServiceStatus.Disabled : ServiceStatus.PendingRemoval;
        } else if (info.updatePriceTime != 0) {
            status = curTime < info.updatePriceTime ? ServiceStatus.PendingUpdate : ServiceStatus.Active;
        } else {
            status = ServiceStatus.Active;
        }        
    }

    /**
     * @dev Get number of connected accounts to the Service{serviceId}
     *
     * @param serviceId Service id
     * @return count Get number of connected accounts to the service
     */
    function getConnectedAccountCount(bytes32 serviceId) public view returns(uint256 count) {
        count = serviceInfoList[serviceId].connectedAccounts.length();
    }

    /**
     * @dev Get list of connected accounts to the Service{serviceId}
     *
     * @param serviceId Service id
     * @return accounts Get connected accounts list to the service
     */
    function getConnectedAccounts(bytes32 serviceId) public view returns(address[] memory) {
        uint256 length = serviceInfoList[serviceId].connectedAccounts.length();
        if(length == 0) {
            address[] memory emptyAry = new address[](0);
            return emptyAry;
        }
        address[] memory accounts = new address[](length);
        for(uint i = 0;i<length;i++){
            accounts[i] = serviceInfoList[serviceId].connectedAccounts.at(i);
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
    function _calcDays(uint256 startTime, uint256 endTime) internal pure returns(uint256) {
        if(endTime <= startTime)
            return 0;
        return (endTime - startTime) / 1 days;
    }
}