import { expect } from "chai";
import hre from "hardhat";
import helpers from "@nomicfoundation/hardhat-network-helpers";

const { ethers } = hre;
const { time } = helpers;

describe("LastWishVault Multi-Recipient", function () {
  let vaultContract;
  let owner;
  let recipientA;
  let recipientB;
  let otherAccount;
  
  const vaultId = ethers.keccak256(ethers.toUtf8Bytes("multi-vault-id"));
  const shareA = "shamir-share-alice-content";
  const shareB = "shamir-share-bob-content";
  const ipfsHashA = "QmXoypizjW3WknFixtn48q671dyCbTKWbifWpNBj413463";
  const ipfsHashB = "QmYoypizjW3WknFixtn48q671dyCbTKWbifWpNBj413464";

  beforeEach(async function () {
    [owner, recipientA, recipientB, otherAccount] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("LastWishVault");
    vaultContract = await factory.deploy();
    await vaultContract.waitForDeployment();
  });

  describe("Vault Creation", function () {
    it("should allow owner to configure a vault with multiple recipients", async function () {
      const configs = [
        {
          recipient: recipientA.address,
          category: "Memories",
          inactivityPeriod: 100,
          gracePeriod: 50,
          share1: shareA,
          ipfsHash: ipfsHashA
        },
        {
          recipient: recipientB.address,
          category: "Finances",
          inactivityPeriod: 200,
          gracePeriod: 100,
          share1: shareB,
          ipfsHash: ipfsHashB
        }
      ];

      const tx = await vaultContract.connect(owner).createVault(vaultId, configs);

      await expect(tx)
        .to.emit(vaultContract, "VaultCreated")
        .withArgs(vaultId, owner.address, 2);

      const details = await vaultContract.getVaultDetails(vaultId);
      expect(details.owner).to.equal(owner.address);
      expect(details.recipientCount).to.equal(2);

      const contractConfigs = await vaultContract.getVaultRecipients(vaultId);
      expect(contractConfigs.length).to.equal(2);
      expect(contractConfigs[0].recipient).to.equal(recipientA.address);
      expect(contractConfigs[0].category).to.equal("Memories");
      expect(contractConfigs[1].recipient).to.equal(recipientB.address);
      expect(contractConfigs[1].category).to.equal("Finances");
    });

    it("should fail if duplicate vault ID", async function () {
      const configs = [
        {
          recipient: recipientA.address,
          category: "Memories",
          inactivityPeriod: 100,
          gracePeriod: 50,
          share1: shareA,
          ipfsHash: ipfsHashA
        }
      ];

      await vaultContract.connect(owner).createVault(vaultId, configs);

      await expect(
        vaultContract.connect(owner).createVault(vaultId, configs)
      ).to.be.revertedWith("LastWishVault: Vault ID already exists.");
    });

    it("should fail if recipient is zero address", async function () {
      const configs = [
        {
          recipient: ethers.ZeroAddress,
          category: "Memories",
          inactivityPeriod: 100,
          gracePeriod: 50,
          share1: shareA,
          ipfsHash: ipfsHashA
        }
      ];

      await expect(
        vaultContract.connect(owner).createVault(vaultId, configs)
      ).to.be.revertedWith("LastWishVault: Recipient address cannot be the zero address.");
    });

    it("should fail if inactivity period is zero", async function () {
      const configs = [
        {
          recipient: recipientA.address,
          category: "Memories",
          inactivityPeriod: 0,
          gracePeriod: 50,
          share1: shareA,
          ipfsHash: ipfsHashA
        }
      ];

      await expect(
        vaultContract.connect(owner).createVault(vaultId, configs)
      ).to.be.revertedWith("LastWishVault: Inactivity period must be greater than zero.");
    });
  });

  describe("Heartbeat & Veto", function () {
    beforeEach(async function () {
      const configs = [
        {
          recipient: recipientA.address,
          category: "Memories",
          inactivityPeriod: 100,
          gracePeriod: 50,
          share1: shareA,
          ipfsHash: ipfsHashA
        }
      ];
      await vaultContract.connect(owner).createVault(vaultId, configs);
    });

    it("should allow owner to reset timer via heartbeat", async function () {
      await time.increase(50);
      const tx = await vaultContract.connect(owner).heartbeat(vaultId);
      const latestTime = await time.latest();

      await expect(tx)
        .to.emit(vaultContract, "HeartbeatUpdated")
        .withArgs(vaultId, latestTime);

      const details = await vaultContract.getVaultDetails(vaultId);
      expect(details.lastHeartbeat).to.equal(latestTime);
    });

    it("should allow owner to veto", async function () {
      await time.increase(110); // inside grace period
      const tx = await vaultContract.connect(owner).veto(vaultId);
      const latestTime = await time.latest();

      await expect(tx)
        .to.emit(vaultContract, "VetoExecuted")
        .withArgs(vaultId, latestTime);
    });

    it("should prevent non-owners from heartbeat/veto", async function () {
      await expect(
        vaultContract.connect(recipientA).heartbeat(vaultId)
      ).to.be.revertedWith("LastWishVault: Only the vault owner can perform this action.");
    });
  });

  describe("Time-Locked Category Claims & Statuses", function () {
    beforeEach(async function () {
      const configs = [
        {
          recipient: recipientA.address,
          category: "Memories",
          inactivityPeriod: 100,
          gracePeriod: 50,
          share1: shareA,
          ipfsHash: ipfsHashA
        },
        {
          recipient: recipientB.address,
          category: "Finances",
          inactivityPeriod: 200,
          gracePeriod: 100,
          share1: shareB,
          ipfsHash: ipfsHashB
        }
      ];
      await vaultContract.connect(owner).createVault(vaultId, configs);
    });

    it("should show ACTIVE status initially", async function () {
      const statusA = await vaultContract.getRecipientStatus(vaultId, recipientA.address, "Memories");
      const statusB = await vaultContract.getRecipientStatus(vaultId, recipientB.address, "Finances");
      expect(statusA).to.equal(0); // Status.ACTIVE
      expect(statusB).to.equal(0);
    });

    it("should transition recipientA to PENDING_UNLOCK while recipientB remains ACTIVE", async function () {
      await time.increase(120);

      const statusA = await vaultContract.getRecipientStatus(vaultId, recipientA.address, "Memories");
      const statusB = await vaultContract.getRecipientStatus(vaultId, recipientB.address, "Finances");
      
      expect(statusA).to.equal(1); // Status.PENDING_UNLOCK
      expect(statusB).to.equal(0); // Status.ACTIVE

      // Claims should fail
      await expect(
        vaultContract.connect(recipientA).claimVaultShare(vaultId, "Memories")
      ).to.be.revertedWith("LastWishVault: Vault is locked. Inactivity period and grace window must expire before retrieval.");
    });

    it("should unlock recipientA after threshold while recipientB remains ACTIVE", async function () {
      await time.increase(160); // 160 > 100 + 50 (recipientA threshold)

      const statusA = await vaultContract.getRecipientStatus(vaultId, recipientA.address, "Memories");
      const statusB = await vaultContract.getRecipientStatus(vaultId, recipientB.address, "Finances");
      
      expect(statusA).to.equal(2); // Status.UNLOCKED
      expect(statusB).to.equal(0); // Status.ACTIVE

      // recipientA claim should succeed
      const claimedShareA = await vaultContract.connect(recipientA).claimVaultShare(vaultId, "Memories");
      expect(claimedShareA).to.equal(shareA);

      // recipientB claim should still fail
      await expect(
        vaultContract.connect(recipientB).claimVaultShare(vaultId, "Finances")
      ).to.be.revertedWith("LastWishVault: Vault is locked. Inactivity period and grace window must expire before retrieval.");
    });

    it("should unlock recipientB after its separate threshold is met", async function () {
      await time.increase(310); // 310 > 200 + 100 (recipientB threshold)

      const statusA = await vaultContract.getRecipientStatus(vaultId, recipientA.address, "Memories");
      const statusB = await vaultContract.getRecipientStatus(vaultId, recipientB.address, "Finances");
      
      expect(statusA).to.equal(2); // Status.UNLOCKED
      expect(statusB).to.equal(2); // Status.UNLOCKED

      const claimedShareB = await vaultContract.connect(recipientB).claimVaultShare(vaultId, "Finances");
      expect(claimedShareB).to.equal(shareB);
    });

    it("should prevent cross-claims or claiming with wrong category", async function () {
      await time.increase(310);

      // recipientA trying to claim Finances should fail
      await expect(
        vaultContract.connect(recipientA).claimVaultShare(vaultId, "Finances")
      ).to.be.revertedWith("LastWishVault: Caller is not a recipient for this category, or vault is locked.");
    });
  });
});
