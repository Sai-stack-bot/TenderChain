const { expect } = require("chai");
const { ethers }  = require("hardhat");
const { time }    = require("@nomicfoundation/hardhat-network-helpers");

describe("TenderManagement", function () {
  let tender;
  let owner, tenderer1, bidder1, bidder2, other;

  const UserRole = { None: 0, Admin: 1, Tenderer: 2, Bidder: 3 };
  const TenderStatus  = { Open: 0, Closed: 1, Awarded: 2, Completed: 3, Cancelled: 4 };
  const BidStatus     = { Submitted: 0, UnderReview: 1, Accepted: 2, Rejected: 3 };
  const ContractStatus= { Created: 0, Active: 1, Completed: 2, Disputed: 3, Terminated: 4 };

  beforeEach(async () => {
    [owner, tenderer1, bidder1, bidder2, other] = await ethers.getSigners();
    const TM = await ethers.getContractFactory("TenderManagement");
    tender = await TM.deploy();

    // Register tenderer and two bidders
    await tender.connect(owner).registerUserByAdmin(
      tenderer1.address, "Tenderer One", "OrgA", UserRole.Tenderer
    );
    await tender.connect(owner).registerUserByAdmin(
      bidder1.address, "Bidder One", "OrgB", UserRole.Bidder
    );
    await tender.connect(owner).registerUserByAdmin(
      bidder2.address, "Bidder Two", "OrgC", UserRole.Bidder
    );
  });

  // ------------------------------------------------------------------
  //  User Management
  // ------------------------------------------------------------------
  describe("User Management", () => {
    it("Owner is registered as Admin on deployment", async () => {
      const u = await tender.users(owner.address);
      expect(u.role).to.equal(UserRole.Admin);
      expect(u.isRegistered).to.be.true;
    });

    it("Admin can register a user", async () => {
      const u = await tender.users(tenderer1.address);
      expect(u.name).to.equal("Tenderer One");
      expect(u.role).to.equal(UserRole.Tenderer);
    });

    it("Non-admin cannot register users", async () => {
      await expect(
        tender.connect(tenderer1).registerUserByAdmin(
          other.address, "Other", "OrgX", UserRole.Bidder
        )
      ).to.be.revertedWith("TM: Only admin");
    });

    it("User can self-register as Tenderer or Bidder", async () => {
      await tender.connect(other).selfRegister("Self User", "OrgS", UserRole.Bidder);
      const u = await tender.users(other.address);
      expect(u.isRegistered).to.be.true;
      expect(u.role).to.equal(UserRole.Bidder);
    });

    it("Self-registration cannot use Admin role", async () => {
      await expect(
        tender.connect(other).selfRegister("Hack", "OrgH", UserRole.Admin)
      ).to.be.revertedWith("TM: Can only register as Tenderer or Bidder");
    });

    it("Cannot register twice", async () => {
      await expect(
        tender.connect(owner).registerUserByAdmin(
          tenderer1.address, "Dup", "OrgD", UserRole.Tenderer
        )
      ).to.be.revertedWith("TM: Already registered");
    });
  });

  // ------------------------------------------------------------------
  //  Tender Management
  // ------------------------------------------------------------------
  describe("Tender Management", () => {
    let deadline;

    beforeEach(async () => {
      deadline = (await time.latest()) + 7 * 24 * 3600; // 7 days from now
    });

    it("Tenderer can create a tender", async () => {
      const tx = await tender.connect(tenderer1).createTender(
        "Road Construction",
        "Build 5km road",
        "Asphalt, gravel",
        ethers.parseEther("100"),
        deadline,
        ["Cost", "Timeline", "Experience"]
      );
      await expect(tx).to.emit(tender, "TenderCreated");
      expect(await tender.tenderCount()).to.equal(1);
    });

    it("Bidder cannot create a tender", async () => {
      await expect(
        tender.connect(bidder1).createTender(
          "T", "D", "R", ethers.parseEther("10"), deadline, ["C"]
        )
      ).to.be.revertedWith("TM: Only tenderer or admin");
    });

    it("Tender requires future deadline", async () => {
      const past = (await time.latest()) - 100;
      await expect(
        tender.connect(tenderer1).createTender(
          "T", "D", "R", ethers.parseEther("10"), past, ["C"]
        )
      ).to.be.revertedWith("TM: Deadline must be future");
    });

    it("Tender can be closed by creator", async () => {
      await tender.connect(tenderer1).createTender(
        "T", "D", "R", ethers.parseEther("10"), deadline, ["C"]
      );
      await expect(tender.connect(tenderer1).closeTender(1))
        .to.emit(tender, "TenderClosed");
      const t = await tender.tenders(1);
      expect(t.status).to.equal(TenderStatus.Closed);
    });

    it("Tender can be cancelled", async () => {
      await tender.connect(tenderer1).createTender(
        "T", "D", "R", ethers.parseEther("10"), deadline, ["C"]
      );
      await tender.connect(tenderer1).cancelTender(1);
      const t = await tender.tenders(1);
      expect(t.status).to.equal(TenderStatus.Cancelled);
    });
  });

  // ------------------------------------------------------------------
  //  Bid Management
  // ------------------------------------------------------------------
  describe("Bid Management", () => {
    let deadline;

    beforeEach(async () => {
      deadline = (await time.latest()) + 7 * 24 * 3600;
      await tender.connect(tenderer1).createTender(
        "Bridge Build", "Build a bridge", "Steel, concrete",
        ethers.parseEther("500"), deadline, ["Cost", "Quality"]
      );
    });

    it("Bidder can submit a bid", async () => {
      await expect(
        tender.connect(bidder1).submitBid(
          1, ethers.parseEther("400"), "My proposal", "Technical details", 90
        )
      ).to.emit(tender, "BidSubmitted");
      expect(await tender.bidCount()).to.equal(1);
    });

    it("Bidder cannot bid twice on same tender", async () => {
      await tender.connect(bidder1).submitBid(
        1, ethers.parseEther("400"), "P1", "T1", 90
      );
      await expect(
        tender.connect(bidder1).submitBid(
          1, ethers.parseEther("300"), "P2", "T2", 80
        )
      ).to.be.revertedWith("TM: Already submitted bid");
    });

    it("Bid cannot exceed budget", async () => {
      await expect(
        tender.connect(bidder1).submitBid(
          1, ethers.parseEther("600"), "P", "T", 90
        )
      ).to.be.revertedWith("TM: Exceeds budget");
    });

    it("Cannot bid on closed tender", async () => {
      await tender.connect(tenderer1).closeTender(1);
      await expect(
        tender.connect(bidder1).submitBid(
          1, ethers.parseEther("400"), "P", "T", 90
        )
      ).to.be.revertedWith("TM: Tender not open");
    });

    it("Non-bidder cannot submit bid", async () => {
      await expect(
        tender.connect(tenderer1).submitBid(
          1, ethers.parseEther("400"), "P", "T", 90
        )
      ).to.be.revertedWith("TM: Only bidder");
    });
  });

  // ------------------------------------------------------------------
  //  Evaluation & Award
  // ------------------------------------------------------------------
  describe("Evaluation and Awarding", () => {
    let deadline;

    beforeEach(async () => {
      deadline = (await time.latest()) + 7 * 24 * 3600;
      await tender.connect(tenderer1).createTender(
        "IT System", "Build IT system", "Web, DB",
        ethers.parseEther("200"), deadline, ["Cost", "Tech"]
      );
      await tender.connect(bidder1).submitBid(
        1, ethers.parseEther("150"), "P1", "T1", 60
      );
      await tender.connect(bidder2).submitBid(
        1, ethers.parseEther("180"), "P2", "T2", 45
      );
      await tender.connect(tenderer1).closeTender(1);
    });

    it("Tenderer can evaluate a bid", async () => {
      await expect(tender.connect(tenderer1).evaluateBid(1, 85))
        .to.emit(tender, "BidEvaluated").withArgs(1, 85);
      const b = await tender.bids(1);
      expect(b.score).to.equal(85);
      expect(b.status).to.equal(BidStatus.UnderReview);
    });

    it("Score cannot exceed 100", async () => {
      await expect(
        tender.connect(tenderer1).evaluateBid(1, 101)
      ).to.be.revertedWith("TM: Score must be 0-100");
    });

    it("Cannot evaluate on open tender", async () => {
      // create a new open tender
      const d2 = (await time.latest()) + 7 * 24 * 3600;
      await tender.connect(tenderer1).createTender(
        "T2", "D2", "R2", ethers.parseEther("100"), d2, ["C"]
      );
      await tender.connect(bidder1).submitBid(
        2, ethers.parseEther("80"), "P", "T", 30
      );
      await expect(
        tender.connect(tenderer1).evaluateBid(3, 80)
      ).to.be.revertedWith("TM: Tender must be closed first");
    });

    it("Awarding tender creates a contract and rejects other bids", async () => {
      await tender.connect(tenderer1).evaluateBid(1, 90);
      await tender.connect(tenderer1).evaluateBid(2, 70);

      const tx = await tender.connect(tenderer1).awardTender(1, 1);
      await expect(tx).to.emit(tender, "TenderAwarded");
      await expect(tx).to.emit(tender, "ContractCreated");

      expect(await tender.contractCount()).to.equal(1);

      const b1 = await tender.bids(1);
      const b2 = await tender.bids(2);
      expect(b1.status).to.equal(BidStatus.Accepted);
      expect(b2.status).to.equal(BidStatus.Rejected);

      const t = await tender.tenders(1);
      expect(t.status).to.equal(TenderStatus.Awarded);
    });
  });

  // ------------------------------------------------------------------
  //  Contract Management
  // ------------------------------------------------------------------
  describe("Contract Management", () => {
    let contractId;

    beforeEach(async () => {
      const deadline = (await time.latest()) + 7 * 24 * 3600;
      await tender.connect(tenderer1).createTender(
        "Software Dev", "Build app", "Node, React",
        ethers.parseEther("300"), deadline, ["Cost", "Quality"]
      );
      await tender.connect(bidder1).submitBid(
        1, ethers.parseEther("250"), "P", "T", 120
      );
      await tender.connect(tenderer1).closeTender(1);
      await tender.connect(tenderer1).evaluateBid(1, 88);
      const tx = await tender.connect(tenderer1).awardTender(1, 1);
      const receipt = await tx.wait();
      contractId = 1;
    });

    it("Contract is Active after award", async () => {
      const c = await tender.contracts(contractId);
      expect(c.status).to.equal(ContractStatus.Active);
    });

    it("Tenderer can complete a contract", async () => {
      await expect(tender.connect(tenderer1).completeContract(contractId))
        .to.emit(tender, "ContractCompleted");
      const c = await tender.contracts(contractId);
      expect(c.status).to.equal(ContractStatus.Completed);
    });

    it("Contractor can raise a dispute", async () => {
      await expect(tender.connect(bidder1).raiseDispute(contractId))
        .to.emit(tender, "ContractDisputed");
      const c = await tender.contracts(contractId);
      expect(c.status).to.equal(ContractStatus.Disputed);
    });

    it("Admin can resolve dispute as completed", async () => {
      await tender.connect(bidder1).raiseDispute(contractId);
      await expect(tender.connect(owner).resolveDispute(contractId, true))
        .to.emit(tender, "DisputeResolved");
      const c = await tender.contracts(contractId);
      expect(c.status).to.equal(ContractStatus.Completed);
    });

    it("Admin can resolve dispute as terminated", async () => {
      await tender.connect(bidder1).raiseDispute(contractId);
      await tender.connect(owner).resolveDispute(contractId, false);
      const c = await tender.contracts(contractId);
      expect(c.status).to.equal(ContractStatus.Terminated);
    });

    it("Non-party cannot raise dispute", async () => {
      await expect(
        tender.connect(other).raiseDispute(contractId)
      ).to.be.revertedWith("TM: Not a party to this contract");
    });
  });
});
