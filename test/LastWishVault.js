import { expect } from "chai";
import hre from "hardhat";
import helpers from "@nomicfoundation/hardhat-network-helpers";

const { ethers } = hre;
const { time } = helpers;

describe("LastWishVault", function () {
  let LastWishVault;
  let vaultContract;
  let owner;
  let recipient;
  let otherAccount;
  
  // Dummy parameters
  const vaultId = ethers.keccak256(ethers.toUtf8Bytes("demo-vault-id"));
  const inactivityPeriod = 100; // seconds
  const gracePeriod = 50;       // seconds
  const share1 = "shamir-share-1-content-here";
  const ipfsHash = "QmXoypizjW3WknFixtn48q671dyCbTKWbifWpNBj413463";

  beforeEach(async function () {
    // Get signers
    [owner, recipient, otherAccount] = await ethers.getSigners();

    // Deploy contract
    const factory = await ethers.getContractFactory("LastWishVault");
    vaultContract = await factory.deploy();
    await vaultContract.waitForDeployment();
  });

  describe("Vault Creation", function () {
    it("should allow a user to create a vault successfully", async function () {
      const tx = await vaultContract.connect(owner).createVault(
        vaultId,
        recipient.address,
        inactivityPeriod,
        gracePeriod,
        share1,
        ipfsHash
      );

      // Verify event was emitted
      await expect(tx)
        .to.emit(vaultContract, "VaultCreated")
        .withArgs(vaultId, owner.address, recipient.address, inactivityPeriod, gracePeriod);

      // Verify vault details
      const details = await vaultContract.getVaultDetails(vaultId);
      expect(details.owner).to.equal(owner.address);
      expect(details.recipient).to.equal(recipient.address);
      expect(details.inactivityPeriod).to.equal(inactivityPeriod);
      expect(details.gracePeriod).to.equal(gracePeriod);
      expect(details.ipfsHash).to.equal(ipfsHash);
      expect(details.status).to.equal(0); // Status.ACTIVE
    });

    it("should fail if vault ID already exists", async function () {
      await vaultContract.connect(owner).createVault(
        vaultId,
        recipient.address,
        inactivityPeriod,
        gracePeriod,
        share1,
        ipfsHash
      );

      await expect(
        vaultContract.connect(owner).createVault(
          vaultId,
          otherAccount.address,
          inactivityPeriod,
          gracePeriod,
          share1,
          ipfsHash
        )
      ).to.be.revertedWith("LastWishVault: Vault ID already exists.");
    });

    it("should fail if recipient is the zero address", async function () {
      await expect(
        vaultContract.connect(owner).createVault(
          vaultId,
          ethers.ZeroAddress,
          inactivityPeriod,
          gracePeriod,
          share1,
          ipfsHash
        )
      ).to.be.revertedWith("LastWishVault: Recipient address cannot be the zero address.");
    });

    it("should fail if inactivity period is zero", async function () {
      await expect(
        vaultContract.connect(owner).createVault(
          vaultId,
          recipient.address,
          0,
          gracePeriod,
          share1,
          ipfsHash
        )
      ).to.be.revertedWith("LastWishVault: Inactivity period must be greater than zero.");
    });
  });

  describe("Heartbeat & Veto", function () {
    beforeEach(async function () {
      await vaultContract.connect(owner).createVault(
        vaultId,
        recipient.address,
        inactivityPeriod,
        gracePeriod,
        share1,
        ipfsHash
      );
    });

    it("should allow the owner to update the heartbeat", async function () {
      // Increase time slightly
      await time.increase(20);

      const tx = await vaultContract.connect(owner).heartbeat(vaultId);
      const latestBlockTime = await time.latest();

      await expect(tx)
        .to.emit(vaultContract, "HeartbeatUpdated")
        .withArgs(vaultId, latestBlockTime);

      const details = await vaultContract.getVaultDetails(vaultId);
      expect(details.lastHeartbeat).to.equal(latestBlockTime);
    });

    it("should prevent non-owners from updating the heartbeat", async function () {
      await expect(
        vaultContract.connect(otherAccount).heartbeat(vaultId)
      ).to.be.revertedWith("LastWishVault: Only the vault owner can perform this action.");
    });

    it("should allow the owner to execute a veto", async function () {
      await time.increase(80); // within inactivity but close to it

      const tx = await vaultContract.connect(owner).veto(vaultId);
      const latestBlockTime = await time.latest();

      await expect(tx)
        .to.emit(vaultContract, "VetoExecuted")
        .withArgs(vaultId, latestBlockTime);

      const details = await vaultContract.getVaultDetails(vaultId);
      expect(details.lastHeartbeat).to.equal(latestBlockTime);
    });

    it("should prevent non-owners from executing a veto", async function () {
      await expect(
        vaultContract.connect(otherAccount).veto(vaultId)
      ).to.be.revertedWith("LastWishVault: Only the vault owner can perform this action.");
    });
  });

  describe("Status Transitions", function () {
    beforeEach(async function () {
      await vaultContract.connect(owner).createVault(
        vaultId,
        recipient.address,
        inactivityPeriod,
        gracePeriod,
        share1,
        ipfsHash
      );
    });

    it("should evaluate status as ACTIVE initially", async function () {
      const status = await vaultContract.getVaultStatus(vaultId);
      expect(status).to.equal(0); // Status.ACTIVE
    });

    it("should transition to PENDING_UNLOCK after inactivityPeriod elapses", async function () {
      // Advance time to exactly inactivityPeriod
      await time.increase(inactivityPeriod);
      const status = await vaultContract.getVaultStatus(vaultId);
      expect(status).to.equal(1); // Status.PENDING_UNLOCK
    });

    it("should transition to UNLOCKED after inactivityPeriod + gracePeriod elapses", async function () {
      // Advance time beyond inactivityPeriod + gracePeriod
      await time.increase(inactivityPeriod + gracePeriod);
      const status = await vaultContract.getVaultStatus(vaultId);
      expect(status).to.equal(2); // Status.UNLOCKED
    });
  });

  describe("Claiming Vault Share", function () {
    beforeEach(async function () {
      await vaultContract.connect(owner).createVault(
        vaultId,
        recipient.address,
        inactivityPeriod,
        gracePeriod,
        share1,
        ipfsHash
      );
    });

    it("should prevent recipient from claiming share while ACTIVE", async function () {
      await expect(
        vaultContract.connect(recipient).claimVaultShare(vaultId)
      ).to.be.revertedWith("LastWishVault: Vault is locked. Inactivity period and grace window must expire before retrieval.");
    });

    it("should prevent recipient from claiming share while PENDING_UNLOCK", async function () {
      await time.increase(inactivityPeriod + 10); // inside grace period
      await expect(
        vaultContract.connect(recipient).claimVaultShare(vaultId)
      ).to.be.revertedWith("LastWishVault: Vault is locked. Inactivity period and grace window must expire before retrieval.");
    });

    it("should allow recipient to claim share when UNLOCKED", async function () {
      await time.increase(inactivityPeriod + gracePeriod + 5); // fully elapsed

      const claimedShare = await vaultContract.connect(recipient).claimVaultShare(vaultId);
      expect(claimedShare).to.equal(share1);
    });

    it("should prevent non-recipient from claiming share even when UNLOCKED", async function () {
      await time.increase(inactivityPeriod + gracePeriod + 5);

      await expect(
        vaultContract.connect(otherAccount).claimVaultShare(vaultId)
      ).to.be.revertedWith("LastWishVault: Only the designated recipient can perform this action.");
    });
  });
});
