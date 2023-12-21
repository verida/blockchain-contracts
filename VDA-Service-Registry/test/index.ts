import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import hre, { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { 
  arrayify,
  BytesLike,
  formatBytes32String,
  parseBytes32String,
  toUtf8Bytes,
  hexZeroPad
} from "ethers/lib/utils";

import { MockVDA } from "../build/typechain/MockVDA";
import { ServiceRegistry } from "../build/typechain/ServiceRegistry";

chai.use(chaiAsPromised);

let tokenContract : MockVDA;
let registryContract: ServiceRegistry;
let accountList : SignerWithAddress[];
let vdaOperator1 : SignerWithAddress;
let vdaOperator2 : SignerWithAddress;
let vdaOperator3 : SignerWithAddress;

let vdaAccount1 : SignerWithAddress;
let vdaAccount2 : SignerWithAddress;
let vdaAccount3 : SignerWithAddress;
let vdaAccount4 : SignerWithAddress;
let vdaAccount5 : SignerWithAddress;

let testSign = arrayify("0x67de2d20880a7d27b71cdcb38817ba95800ca82dff557cedd91b96aacb9062e80b9e0b8cb9614fd61ce364502349e9079c26abaa21890d7bc2f1f6c8ff77f6261c");
let wrongSign = arrayify("0xf157fd349172fa8bb84710d871724091947289182373198723918cabcc888ef888ff8876956050565d5757a57d868b8676876e7678687686f95419238191488923");

let ServiceStatus = {
  Active: 0,
  Disabled: 1,
  PendingUpdate: 2,
  PendingRemoval: 3
}

before(async () => {
  await hre.network.provider.send("hardhat_reset");
  await hre.network.provider.request(
    {
      method: "hardhat_reset",
      params: []
    }
  );

  accountList = await ethers.getSigners();
})

describe("Service Registry", function () {

  this.beforeAll(async () => {
    const tokenFactory = await ethers.getContractFactory("MockVDA");
    tokenContract = await tokenFactory.deploy() as MockVDA;
    await tokenContract.deployed();

    const registryFactory = await ethers.getContractFactory("ServiceRegistry");
    registryContract = await registryFactory.deploy(tokenContract.address) as ServiceRegistry;
    await registryContract.deployed();

    // Minting tokens to test generated accounts.
    for(let i = 0;i<accountList.length;i++) {
      await tokenContract.mintTokens(accountList[i].address, 25000);
    }

    vdaOperator1 = accountList[1];
    vdaOperator2 = accountList[2];
    vdaOperator3 = accountList[3];

    vdaAccount1 = accountList[4];
    vdaAccount2 = accountList[5];
    vdaAccount3 = accountList[6];
    vdaAccount4 = accountList[7];
    vdaAccount5 = accountList[8];

    // Provide spending approval from address accounts to serviceRegistry contract
    for(let i = 0;i<accountList.length;i++) {
      await tokenContract.connect(accountList[i]).approve(registryContract.address, 1000000);
    }
  });

  describe("Add Credit", async () => {
    /**
     vdaOperator1 add credit 13000
     vdaOperator2 add credit 9000
     vdaOperator3 add credit 8000
     
     vdaAccounts add credit 18000
     */
    it("Successfully add Credit to the Verida accounts", async () => {
      await registryContract.connect(vdaOperator1).addCredit(vdaOperator1.address, 13000, testSign);
      expect(await registryContract.getAccountCredit(vdaOperator1.address)).to.be.eq(13000);

      await registryContract.connect(vdaOperator2).addCredit(vdaOperator2.address, 3000, testSign);
      await registryContract.connect(vdaOperator2).addCredit(vdaOperator2.address, 6000, testSign);
      expect(await registryContract.getAccountCredit(vdaOperator2.address)).to.be.eq(9000);
      
      await registryContract.connect(vdaOperator3).addCredit(vdaOperator3.address, 8000, testSign);
      expect(await registryContract.getAccountCredit(vdaOperator3.address)).to.be.eq(8000);

      for(let i = 0;i<5;i++) {
        await registryContract.connect(accountList[i + 4]).addCredit(accountList[i + 4].address, 18000, testSign);
        expect(await registryContract.getAccountCredit(accountList[i + 4].address)).to.be.eq(18000);
      }
    })

    it("Add credit fail due to wrong signature", async () => {
      await expect(registryContract.connect(vdaOperator1).addCredit(vdaOperator1.address, 300, wrongSign)).to.be.rejectedWith("bad_actor");
    })

    it("Add credit fail due to insufficient token balance", async () => {
      await expect(registryContract.connect(vdaOperator1).addCredit(vdaOperator1.address, 13000, testSign)).to.be.rejectedWith("Insufficient funds to add credit");
    })
  })
  
  describe("Register Service", async () => {
    it("Get registered service list - No service", async () => {
      const serviceIds = await registryContract.getRegisteredIds(vdaOperator1.address);
      expect(serviceIds.length).to.be.eq(0);
    })
    it("Successfully register service", async () => {
      // vdaOperator1 register "VeridaDatabase" service - maxAccounts = 2, pricePerDayPerAccount: 400
      // vdaOperator1 initial credit amount = 13000
      expect(await registryContract.getAccountCredit(vdaOperator1.address)).to.be.eq(13000);
      await registryContract.registerService(
        vdaOperator1.address,
        {
          serviceType:"VeridaDatabase",
          endpointUri:"https://rpc-mumbai.matic.today",
          country: "AUS",
          maxAccounts: 2,
          pricePerDayPerAccount: 400
        },
        testSign
      )
      // vdaOperator1 credit amount = 12400
      expect(await registryContract.getAccountCredit(vdaOperator1.address)).to.be.eq(12400);

      // Confirm the service was registered successfully.
      const serviceByOpr1 = await registryContract.getRegisteredIds(vdaOperator1.address);
      const dbService1 = await registryContract.getServiceDetail(serviceByOpr1[0]);
      expect(dbService1.serviceType).to.be.eq("VeridaDatabase");

      // vdaOperator1 register "VeridaMessaging" service - maxAccounts = 5, pricePerDayPerAccount: 500
      await registryContract.registerService(
        vdaOperator1.address,
        {
          serviceType:"VeridaMessaging",
          endpointUri:"https://rpc-mumbai.matic.today",
          country: "CAN",
          maxAccounts: 5,
          pricePerDayPerAccount: 500
        },
        testSign
      )
      // vdaOperator1 credit amount = 10400
      expect(await registryContract.getAccountCredit(vdaOperator1.address)).to.be.eq(10400);

      // vdaOperator1 register "VeridaNotification" service - maxAccounts = 10, pricePerDayPerAccount: 200
      await registryContract.registerService(
        vdaOperator1.address,
        {
          serviceType:"VeridaNotification",
          endpointUri:"https://rpc-mumbai.matic.today",
          country: "CAN",
          maxAccounts: 10,
          pricePerDayPerAccount: 200
        },
        testSign
      )
      // vdaOperator1 credit amount = 8900
      expect(await registryContract.getAccountCredit(vdaOperator1.address)).to.be.eq(8900);

      // vdaOperator2 register "VeridaDatabase" service - maxAccounts = 3, pricePerDayPerAccount: 350
      // vdaOperator2 initial credit amount = 9000
      expect(await registryContract.getAccountCredit(vdaOperator2.address)).to.be.eq(9000);
      await registryContract.registerService(
        vdaOperator2.address,
        {
          serviceType:"VeridaDatabase",
          endpointUri:"https://rpc-mumbai.matic.today",
          country: "IND",
          maxAccounts: 3,
          pricePerDayPerAccount: 350
        },
        testSign
      )
      // vdaOperator2 credit amount = 8100
      expect(await registryContract.getAccountCredit(vdaOperator2.address)).to.be.eq(8100);

      // vdaOperator2 register "VeridaMessaging" service - maxAccounts = 8, pricePerDayPerAccount: 700
      await registryContract.registerService(
        vdaOperator2.address,
        {
          serviceType:"VeridaMessaging",
          endpointUri:"https://rpc-mumbai.matic.today",
          country: "USA",
          maxAccounts: 8,
          pricePerDayPerAccount: 700
        },
        testSign
      )
      // vdaOperator2 credit amount = 4900
      expect(await registryContract.getAccountCredit(vdaOperator2.address)).to.be.eq(4900);

      // vdaOperator3 initial credit amount = 8000
      expect(await registryContract.getAccountCredit(vdaOperator3.address)).to.be.eq(8000);
      // vdaOperator3 register "VeridaMessaging" service - maxAccounts = 15, pricePerDayPerAccount: 450
      await registryContract.registerService(
        vdaOperator3.address,
        {
          serviceType:"VeridaMessaging",
          endpointUri:"https://rpc-mumbai.matic.today",
          country: "HK",
          maxAccounts: 15,
          pricePerDayPerAccount: 450
        },
        testSign
      )
      // vdaOperator3 credit amount = 2000
      expect(await registryContract.getAccountCredit(vdaOperator3.address)).to.be.eq(2000);

      // vdaOperator3 register "VeridaStorage" service - maxAccounts = 5, pricePerDayPerAccount: 120
      await registryContract.registerService(
        vdaOperator3.address,
        {
          serviceType:"VeridaStorage",
          endpointUri:"https://rpc-mumbai.matic.today",
          country: "IND",
          maxAccounts: 5,
          pricePerDayPerAccount: 120
        },
        testSign
      )
      // vdaOperator3 credit amount = 1500
    })

    it("Registering service fail due to wrong signature", async () => {
      await expect(registryContract.registerService(
        vdaOperator1.address,
        {
          serviceType:"VeridaMessage",
          endpointUri:"https://rpc-mumbai.matic.today",
          country: "SIN",
          maxAccounts: 10,
          pricePerDayPerAccount: 700
        },
        wrongSign
      ))
    })

    it("Check that service has already registered", async () => {
      await registryContract.registerService(
        vdaOperator1.address,
        {
          serviceType:"VeridaMessage",
          endpointUri:"https://rpc-mumbai.matic.today",
          country: "HK",
          maxAccounts: 10,
          pricePerDayPerAccount: 700
        },
        testSign
      )
    })

    it("Registering service fail due to insufficient credit", async () => {
      expect(await registryContract.getAccountCredit(vdaOperator3.address)).to.be.eq(1500);
      /// Try to create maxAccounts = 30, pricePerDayPerAccount = 450,
      /// but it requires maxAccounts*vdaPerAccount['messaging'] = 6000
      await expect(registryContract.registerService(
        vdaOperator3.address,
        {
          serviceType:"VeridaDatabase",
          endpointUri:"https://rpc-mumbai.matic.today",
          country: "SIN",
          maxAccounts: 30,
          pricePerDayPerAccount: 450
        },
        testSign
      )).to.be.rejectedWith("Not enough credit to register service");
    })
  });

  describe("Discover Services", async () => {
    it("Discover services with all params", async () => {
      const res = await registryContract.discoverServices("database", "VeridaDatabase", "IND", 1000 );
      for(let i = 0;i<res.length;i++) {
        const _detail = await registryContract.getServiceDetail(res[i]);
        expect(_detail.infraType).to.be.eq("database");
        expect(_detail.serviceType).to.be.eq("VeridaDatabase");
        expect(_detail.country).to.be.eq("IND");
      }
    })

    it("Discover services without country", async () => {
      const res1 = await registryContract.discoverServices("database", "VeridaDatabase", "", 1000 );
      for(let i = 0;i<res1.length;i++) {
        const _detail = await registryContract.getServiceDetail(res1[i]);
        console.log("detail:", _detail);
        expect(_detail.infraType).to.be.eq("database");
        expect(_detail.serviceType).to.be.eq("VeridaDatabase");
      }
    })

    it("Discover services without service type", async () => {
      const res = await registryContract.discoverServices("database", "", "AUS", 1000 );
      for(let i = 0;i<res.length;i++) {
        const _detail = await registryContract.getServiceDetail(res[i]);
        console.log("detail:", _detail);
        expect(_detail.infraType).to.be.eq("database");
        expect(_detail.country).to.be.eq("AUS");
      }
    })

    it("Discover services without infra type", async () => {
      const res = await registryContract.discoverServices("", "VeridaDatabase", "AUS", 1000 );
      for(let i = 0;i<res.length;i++) {
        const _detail = await registryContract.getServiceDetail(res[i]);
        console.log("detail:", _detail);
        expect(_detail.serviceType).to.be.eq("VeridaDatabase");
        expect(_detail.country).to.be.eq("AUS");
      }
    })

  })

  describe("Connect Service", async () => {
    it("Successfully VDA accounts connect to the service", async () => {
      // [0] = VeridaDatabase : max = 2, pricePerDay = 400
      // [1] = VeridaMessaing : max = 5, pricePerDay = 500
      // [2] = VeridaNotification : max = 10, pricePerDay = 200
      let servicesByVda1 = await registryContract.getRegisteredIds(vdaOperator1.address);
      // console.log("service1[0]=", servicesByVda1[0]);
      expect(await registryContract.getAccountCredit(vdaAccount1.address)).to.be.eq(18000);
      await registryContract.connectService(vdaAccount1.address, servicesByVda1[0], testSign);
      expect(await registryContract.getAccountCredit(vdaAccount1.address)).to.be.eq(6000);
      
      expect(await registryContract.getAccountCredit(vdaAccount2.address)).to.be.eq(18000);
      await registryContract.connectService(vdaAccount2.address, servicesByVda1[0], testSign);
      expect(await registryContract.getAccountCredit(vdaAccount2.address)).to.be.eq(6000);
      let connectedAccounts = await registryContract.getConnectedAccounts(servicesByVda1[0]);
      expect(connectedAccounts[0]).to.be.eq(vdaAccount1.address);
      expect(connectedAccounts[1]).to.be.eq(vdaAccount2.address);

      // [0] = VeridaDatabase : max = 3, pricePerDay = 350
      // [1] = VeridaMessaing : max = 8, pricePerDay = 700
      let servicesByVda2 = await registryContract.getRegisteredIds(vdaOperator2.address);
      expect(await registryContract.getServiceCredit(servicesByVda2[0])).to.be.eq(900);
      
      expect(await registryContract.getAccountCredit(vdaAccount3.address)).to.be.eq(18000);
      await registryContract.connectService(vdaAccount3.address, servicesByVda2[0], testSign);
      expect(await registryContract.getAccountCredit(vdaAccount3.address)).to.be.eq(7500);
      
      expect(await registryContract.getAccountCredit(vdaAccount4.address)).to.be.eq(18000);
      await registryContract.connectService(vdaAccount4.address, servicesByVda2[0], testSign);
      expect(await registryContract.getAccountCredit(vdaAccount4.address)).to.be.eq(7500);

      expect(await registryContract.getServiceCredit(servicesByVda2[0])).to.be.eq(21900);

      let servicesByVda3 = await registryContract.getRegisteredIds(vdaOperator3.address);
      expect(await registryContract.getAccountCredit(vdaAccount5.address)).to.be.eq(18000);
      await registryContract.connectService(vdaAccount5.address, servicesByVda3[0],testSign);
      expect(await registryContract.getAccountCredit(vdaAccount5.address)).to.be.eq(4500);
    })

    it("Cannot connect to pending removal Service", async () => {
      let servicesByVda3 = await registryContract.getRegisteredIds(vdaOperator3.address);
      // console.log("service3[0]=", servicesByVda3[0]);
      await registryContract.deregisterService(vdaOperator3.address, servicesByVda3[0], testSign);

      await expect(registryContract.connectService(vdaAccount1.address, servicesByVda3[0], testSign)).to.be.rejectedWith("Service is pending removal");
    })

    

    it("Connect to the service fail due to the wrong signature", async () => {
      let servicesByVda1 = await registryContract.getRegisteredIds(vdaOperator1.address);
      await expect(registryContract.connectService(vdaAccount1.address, servicesByVda1[0], wrongSign)).to.be.rejectedWith("bad_actor");
    })

    it("Already connected account", async() => {
      let servicesByVda1 = await registryContract.getRegisteredIds(vdaOperator1.address);
      await expect(registryContract.connectService(vdaAccount1.address, servicesByVda1[0], testSign)).to.be.rejectedWith("Already connected");
    })

    it("Service hits maximum number of connected accounts", async() => {
      let servicesByVda1 = await registryContract.getRegisteredIds(vdaOperator1.address);
      await expect(registryContract.connectService(vdaAccount3.address, servicesByVda1[0], testSign)).to.be.rejectedWith("Service hits maximum number of connected accounts");
    })

    it("Not enough token to connect service", async () => {
      let servicesByVda2 = await registryContract.getRegisteredIds(vdaOperator2.address);
      // [0] = vdaOperator2.VeridaDatabase: max=3, pricePerDay = 350
      // [1] = vdaOperator2.VeridaMessaging: max=8, pricePerDay = 700
      expect(await registryContract.getAccountCredit(vdaAccount5.address)).to.be.eq(4500);
      // 700 * 30(=minimumDaysCreditPerService) = 21000
      await expect(registryContract.connectService(vdaAccount5.address, servicesByVda2[1], testSign)).to.be.rejectedWith("Not enough VDA to connect service");
    })
  })

  describe("Disconnect service", async () => {
    it("Account is not connected to service", async () => {
      let servicesByVda2 = await registryContract.getRegisteredIds(vdaOperator2.address);
      await expect(registryContract.disconnectService(vdaAccount5.address, servicesByVda2[0],testSign)).to.be.rejectedWith("Account is not connected to service");
    })

    it("Successfully disconnect from the service", async () => {
      let servicesByVda2 = await registryContract.getRegisteredIds(vdaOperator2.address);
      expect(await registryContract.getAccountCredit(vdaAccount4.address)).to.be.eq(7500);

      /// ===== Time flows 3 days =====
      console.log("========== Time flows 3 days: Total=3 ==========");
      await network.provider.send("evm_increaseTime", [3600 * 24 * 3]);

      let prevCount = await registryContract.getConnectedAccountCount(servicesByVda2[0]);
      await registryContract.disconnectService(vdaAccount4.address, servicesByVda2[0], testSign);
      let count = await registryContract.getConnectedAccountCount(servicesByVda2[0]);
      expect(prevCount).to.be.eq(count.add(1));
      let serviceDetail = await registryContract.getConnectedAccounts(servicesByVda2[0]);
      expect(serviceDetail[0] != vdaAccount4.address).to.be.eq(true);
      expect(await registryContract.getAccountCredit(vdaAccount4.address)).to.be.eq(16600);
    })

    it("Disconnect from the service failed due to the wrong signature", async () => {
      let servicesByVda1 = await registryContract.getRegisteredIds(vdaOperator1.address);
      await expect(registryContract.disconnectService(vdaAccount1.address, servicesByVda1[0], wrongSign)).to.be.rejectedWith("bad_actor");
    })
  })

  describe("Claim", async() => {
    it("Should claim after 7 days from the last claim", async () => {
      let servicesByVda3 = await registryContract.getRegisteredIds(vdaOperator3.address);
      let testId = servicesByVda3[0];
      console.log("serviceCredit=", await registryContract.getServiceCredit(testId));
      await expect(registryContract.claim(vdaOperator3.address, testId, testSign)).to.be.rejectedWith("Should claim after 7 days from the last claim");
    })

    it("Successfully claim tokens", async () => {
      /// ===== Time flows 5 days =====
      console.log("========== Time flows 5 days: Total=8 ==========");
      await network.provider.send("evm_increaseTime", [3600 * 24 * 5]);
      
      let servicesByVda3 = await registryContract.getRegisteredIds(vdaOperator3.address);
      let testId = servicesByVda3[0];
      expect(await registryContract.getAccountCredit(vdaOperator3.address)).to.be.eq(1500);
      await registryContract.claim(vdaOperator3.address, testId, testSign);
      expect(await registryContract.getAccountCredit(vdaOperator3.address)).to.be.eq(5100);
    })
  })

  describe("Deregister Service", async () => {
    it("Deregister service", async () => {
      let servicesByVda3 = await registryContract.getRegisteredIds(vdaOperator3.address);
      const testId = servicesByVda3[1];
      let beforeStatus = await registryContract.getServiceStatus(testId);
      expect(beforeStatus).to.be.eq(ServiceStatus.Active);
      await registryContract.deregisterService(vdaOperator3.address, testId, testSign);
      let afterStatus = await registryContract.getServiceStatus(testId);
      expect(afterStatus).to.be.eq(ServiceStatus.PendingRemoval);
    })

    it("Service is pending removal", async () => {
      let servicesByVda3 = await registryContract.getRegisteredIds(vdaOperator3.address);
      const testId = servicesByVda3[0];
      await expect(registryContract.deregisterService(vdaOperator3.address, testId, testSign)).to.be.rejectedWith("Service is pending removal");
    })

    it("Remove service from list failed due to time limit", async () => {
      let servicesByVda3 = await registryContract.getRegisteredIds(vdaOperator3.address);
      const testId = servicesByVda3[0];
      await expect(registryContract.removeService(vdaOperator3.address, testId, testSign)).to.be.rejectedWith("Not ready to remove");
    })

    it("Successfully remove service from list", async () => {
      let servicesByVda3 = await registryContract.getRegisteredIds(vdaOperator3.address);
      const testId = servicesByVda3[0];
     
      // console.log("serviceCredit=", await registryContract.getServiceCredit(testId));

      /// ===== Time flows 30 days =====
      // console.log("========== Time flows 30 days: Total=38 ==========");
      await network.provider.send("evm_increaseTime", [3600 * 24 * 30]);
      // console.log("before:", await registryContract.getAccountCredit(vdaOperator3.address));
      await registryContract.claim(vdaOperator3.address, testId, testSign);
      // console.log("after:", await registryContract.getAccountCredit(vdaOperator3.address));

      // console.log("serviceCredit=", await registryContract.getServiceCredit(testId));
      expect(await registryContract.getAccountCredit(vdaOperator3.address)).to.be.eq(5100);
      await registryContract.removeService(vdaOperator3.address, testId, testSign);
      expect(await registryContract.getAccountCredit(vdaOperator3.address)).to.be.eq(11550);
    })
  })

  describe("Update service", async () => {
    it("Successfully update the service - maxAccounts increased", async () => {
      let servicesByVda1 = await registryContract.getRegisteredIds(vdaOperator1.address);
      let testId = servicesByVda1[1];
      console.log("typeof testId", typeof testId);
      expect(await registryContract.getServiceCredit(testId)).to.be.eq(2000);

      await registryContract.updateService(
        vdaOperator1.address,
        testId,
        8,
        500,
        testSign
      );

      expect(await registryContract.getServiceCredit(testId)).to.be.eq(3200);
    })

    it("Cannot update service due to limit to priceChangeDelayDays", async () => {
      let servicesByVda1 = await registryContract.getRegisteredIds(vdaOperator1.address);
      let testId = servicesByVda1[1];
      console.log("typeof testId", typeof testId);

      await expect(registryContract.updateService(
        vdaOperator1.address,
        testId,
        8,
        500,
        testSign
      )).to.be.rejectedWith("Cannot update service due to limit to priceChangeDelayDays");
    })

    it("Successfully update the service - maxAccounts decreased", async () => {
      /// ========== Time flows 30 days ==========
      await network.provider.send("evm_increaseTime", [3600 * 24 * 30]);

      let servicesByVda1 = await registryContract.getRegisteredIds(vdaOperator1.address);
      let testId = servicesByVda1[1];
      console.log("typeof testId", typeof testId);
      expect(await registryContract.getServiceCredit(testId)).to.be.eq(3200);

      await registryContract.updateService(
        vdaOperator1.address,
        testId,
        8,
        500,
        testSign
      );

      expect(await registryContract.getServiceCredit(testId)).to.be.eq(900);
    })
  })

  describe("Remove Credit", async () => {
    it("Value cannot be zero", async () => {
      await expect(registryContract.removeCredit(vdaAccount4.address, 0, testSign)).to.be.rejectedWith("Value cannot be zero");
    })

    it("Successfully remove credit", async () => {
      expect(await registryContract.getAccountCredit(vdaAccount4.address)).to.be.eq(16600);
      expect(await tokenContract.getBalance(vdaAccount4.address)).to.be.eq(7000);
      await registryContract.connect(vdaAccount4).removeCredit(vdaAccount4.address, 6000, testSign);
      expect(await registryContract.getAccountCredit(vdaAccount4.address)).to.be.eq(10600);
      expect(await tokenContract.getBalance(vdaAccount4.address)).to.be.eq(13000);
    })

    it("Remove credit fail due to the wrong signature", async () => {
      await expect(registryContract.removeCredit(vdaAccount4.address, 1000, wrongSign)).to.be.rejectedWith("bad_actor");
    })
    
    it("Not enough credit to remove", async () => {
      expect(await registryContract.getAccountCredit(vdaAccount4.address)).to.be.eq(10600);
      await expect(registryContract.removeCredit(vdaAccount4.address, 12000, testSign)).to.be.rejectedWith("Not enough credit to remove");
    })
  })
});
