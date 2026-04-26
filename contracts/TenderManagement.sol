// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TenderManagement
 * @dev Blockchain-based Tender and Contract Management System
 */
contract TenderManagement {

    // ===========================
    //        ENUMERATIONS
    // ===========================
    enum TenderStatus  { Open, Closed, Awarded, Completed, Cancelled }
    enum BidStatus     { Submitted, UnderReview, Accepted, Rejected }
    enum ContractStatus{ Created, Active, Completed, Disputed, Terminated }
    enum UserRole      { None, Admin, Tenderer, Bidder }

    // ===========================
    //          STRUCTS
    // ===========================
    struct User {
        address userAddress;
        string  name;
        string  organization;
        UserRole role;
        bool    isRegistered;
        uint256 registeredAt;
    }

    struct Tender {
        uint256  tenderId;
        string   title;
        string   description;
        string   requirements;
        uint256  budget;
        uint256  deadline;
        address  createdBy;
        TenderStatus status;
        uint256  createdAt;
        string[] evaluationCriteria;
        uint256  winningBidId;
    }

    struct Bid {
        uint256  bidId;
        uint256  tenderId;
        address  bidder;
        uint256  amount;
        string   proposal;
        string   technicalDetails;
        uint256  deliveryDays;
        uint256  score;
        BidStatus status;
        uint256  submittedAt;
    }

    struct Contract {
        uint256  contractId;
        uint256  tenderId;
        uint256  bidId;
        address  tenderer;
        address  contractor;
        uint256  value;
        string   terms;
        ContractStatus status;
        uint256  createdAt;
        uint256  completedAt;
    }

    // ===========================
    //       STATE VARIABLES
    // ===========================
    address public owner;
    uint256 public tenderCount;
    uint256 public bidCount;
    uint256 public contractCount;

    mapping(address  => User)       public users;
    mapping(uint256  => Tender)     public tenders;
    mapping(uint256  => Bid)        public bids;
    mapping(uint256  => Contract)   public contracts;
    mapping(uint256  => uint256[])  public tenderBids;   // tenderId  => bidIds[]
    mapping(address  => uint256[])  public userBids;     // bidder    => bidIds[]
    mapping(address  => uint256[])  public userTenders;  // tenderer  => tenderIds[]
    mapping(uint256  => uint256)    public tenderContract; // tenderId => contractId

    // ===========================
    //          EVENTS
    // ===========================
    event UserRegistered    (address indexed user, string name, UserRole role);
    event TenderCreated     (uint256 indexed tenderId, string title, address indexed createdBy);
    event TenderClosed      (uint256 indexed tenderId);
    event TenderCancelled   (uint256 indexed tenderId);
    event BidSubmitted      (uint256 indexed bidId, uint256 indexed tenderId, address indexed bidder);
    event BidEvaluated      (uint256 indexed bidId, uint256 score);
    event TenderAwarded     (uint256 indexed tenderId, uint256 indexed bidId, address contractor);
    event ContractCreated   (uint256 indexed contractId, uint256 indexed tenderId);
    event ContractCompleted (uint256 indexed contractId);
    event ContractDisputed  (uint256 indexed contractId);
    event DisputeResolved   (uint256 indexed contractId, bool completed);

    // ===========================
    //         MODIFIERS
    // ===========================
    modifier onlyOwner() {
        require(msg.sender == owner, "TM: Only owner");
        _;
    }

    modifier onlyRegistered() {
        require(users[msg.sender].isRegistered, "TM: Not registered");
        _;
    }

    modifier onlyAdmin() {
        require(
            users[msg.sender].role == UserRole.Admin,
            "TM: Only admin"
        );
        _;
    }

    modifier onlyTendererOrAdmin() {
        require(
            users[msg.sender].role == UserRole.Tenderer ||
            users[msg.sender].role == UserRole.Admin,
            "TM: Only tenderer or admin"
        );
        _;
    }

    modifier onlyBidder() {
        require(users[msg.sender].role == UserRole.Bidder, "TM: Only bidder");
        _;
    }

    // ===========================
    //        CONSTRUCTOR
    // ===========================
    constructor() {
        owner = msg.sender;
        users[msg.sender] = User({
            userAddress : msg.sender,
            name        : "System Admin",
            organization: "System",
            role        : UserRole.Admin,
            isRegistered: true,
            registeredAt: block.timestamp
        });
        emit UserRegistered(msg.sender, "System Admin", UserRole.Admin);
    }

    // ===========================
    //      USER MANAGEMENT
    // ===========================

    /**
     * @dev Admin registers a specific user with a given role.
     */
    function registerUserByAdmin(
        address  _user,
        string   memory _name,
        string   memory _organization,
        UserRole _role
    ) external onlyAdmin {
        require(!users[_user].isRegistered,  "TM: Already registered");
        require(_role != UserRole.None,       "TM: Invalid role");
        _createUser(_user, _name, _organization, _role);
    }

    /**
     * @dev Anyone can self-register as Tenderer or Bidder.
     */
    function selfRegister(
        string   memory _name,
        string   memory _organization,
        UserRole _role
    ) external {
        require(!users[msg.sender].isRegistered, "TM: Already registered");
        require(
            _role == UserRole.Tenderer || _role == UserRole.Bidder,
            "TM: Can only register as Tenderer or Bidder"
        );
        _createUser(msg.sender, _name, _organization, _role);
    }

    function _createUser(
        address  _addr,
        string   memory _name,
        string   memory _org,
        UserRole _role
    ) internal {
        users[_addr] = User({
            userAddress : _addr,
            name        : _name,
            organization: _org,
            role        : _role,
            isRegistered: true,
            registeredAt: block.timestamp
        });
        emit UserRegistered(_addr, _name, _role);
    }

    function getUser(address _addr) external view returns (User memory) {
        return users[_addr];
    }

    // ===========================
    //     TENDER MANAGEMENT
    // ===========================

    /**
     * @dev Create and immediately publish a tender (status = Open).
     */
    function createTender(
        string   memory _title,
        string   memory _description,
        string   memory _requirements,
        uint256  _budget,
        uint256  _deadline,
        string[] memory _evaluationCriteria
    ) external onlyTendererOrAdmin returns (uint256) {
        require(bytes(_title).length > 0,        "TM: Title required");
        require(_budget > 0,                     "TM: Budget must be > 0");
        require(_deadline > block.timestamp,     "TM: Deadline must be future");
        require(_evaluationCriteria.length > 0,  "TM: Need evaluation criteria");

        tenderCount++;
        Tender storage t = tenders[tenderCount];
        t.tenderId            = tenderCount;
        t.title               = _title;
        t.description         = _description;
        t.requirements        = _requirements;
        t.budget              = _budget;
        t.deadline            = _deadline;
        t.createdBy           = msg.sender;
        t.status              = TenderStatus.Open;
        t.createdAt           = block.timestamp;
        t.evaluationCriteria  = _evaluationCriteria;
        t.winningBidId        = 0;

        userTenders[msg.sender].push(tenderCount);
        emit TenderCreated(tenderCount, _title, msg.sender);
        return tenderCount;
    }

    /**
     * @dev Close a tender so no more bids can be submitted.
     */
    function closeTender(uint256 _tenderId) external {
        Tender storage t = tenders[_tenderId];
        require(
            t.createdBy == msg.sender || users[msg.sender].role == UserRole.Admin,
            "TM: Not authorized"
        );
        require(t.status == TenderStatus.Open, "TM: Tender not open");
        t.status = TenderStatus.Closed;
        emit TenderClosed(_tenderId);
    }

    /**
     * @dev Cancel a tender (only if Open or Closed and not yet awarded).
     */
    function cancelTender(uint256 _tenderId) external {
        Tender storage t = tenders[_tenderId];
        require(
            t.createdBy == msg.sender || users[msg.sender].role == UserRole.Admin,
            "TM: Not authorized"
        );
        require(
            t.status == TenderStatus.Open || t.status == TenderStatus.Closed,
            "TM: Cannot cancel at this stage"
        );
        t.status = TenderStatus.Cancelled;
        // Reject all pending bids
        uint256[] storage bidList = tenderBids[_tenderId];
        for (uint i = 0; i < bidList.length; i++) {
            if (bids[bidList[i]].status == BidStatus.Submitted ||
                bids[bidList[i]].status == BidStatus.UnderReview) {
                bids[bidList[i]].status = BidStatus.Rejected;
            }
        }
        emit TenderCancelled(_tenderId);
    }

    function getTender(uint256 _id) external view returns (Tender memory) {
        return tenders[_id];
    }

    function getTenderEvaluationCriteria(uint256 _id) external view returns (string[] memory) {
        return tenders[_id].evaluationCriteria;
    }

    function getAllTenderIds() external view returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](tenderCount);
        for (uint256 i = 0; i < tenderCount; i++) ids[i] = i + 1;
        return ids;
    }

    function getUserTenders(address _addr) external view returns (uint256[] memory) {
        return userTenders[_addr];
    }

    // ===========================
    //       BID MANAGEMENT
    // ===========================

    /**
     * @dev Submit a bid on an open tender.
     */
    function submitBid(
        uint256 _tenderId,
        uint256 _amount,
        string  memory _proposal,
        string  memory _technicalDetails,
        uint256 _deliveryDays
    ) external onlyBidder returns (uint256) {
        Tender storage t = tenders[_tenderId];
        require(t.tenderId != 0,                   "TM: Tender does not exist");
        require(t.status == TenderStatus.Open,     "TM: Tender not open");
        require(block.timestamp < t.deadline,      "TM: Deadline passed");
        require(_amount > 0,                       "TM: Amount must be > 0");
        require(_amount <= t.budget,               "TM: Exceeds budget");
        require(_deliveryDays > 0,                 "TM: Delivery days required");

        // Prevent duplicate bids from same bidder
        uint256[] storage existingBids = tenderBids[_tenderId];
        for (uint i = 0; i < existingBids.length; i++) {
            require(bids[existingBids[i]].bidder != msg.sender, "TM: Already submitted bid");
        }

        bidCount++;
        bids[bidCount] = Bid({
            bidId          : bidCount,
            tenderId       : _tenderId,
            bidder         : msg.sender,
            amount         : _amount,
            proposal       : _proposal,
            technicalDetails: _technicalDetails,
            deliveryDays   : _deliveryDays,
            score          : 0,
            status         : BidStatus.Submitted,
            submittedAt    : block.timestamp
        });

        tenderBids[_tenderId].push(bidCount);
        userBids[msg.sender].push(bidCount);
        emit BidSubmitted(bidCount, _tenderId, msg.sender);
        return bidCount;
    }

    /**
     * @dev Evaluate a specific bid by assigning a score (0–100).
     *      Tender must be Closed before evaluation.
     */
    function evaluateBid(uint256 _bidId, uint256 _score) external {
        require(_score <= 100, "TM: Score must be 0-100");
        Bid    storage b = bids[_bidId];
        Tender storage t = tenders[b.tenderId];
        require(b.bidId != 0,                      "TM: Bid does not exist");
        require(
            t.createdBy == msg.sender || users[msg.sender].role == UserRole.Admin,
            "TM: Not authorized"
        );
        require(t.status == TenderStatus.Closed,   "TM: Tender must be closed first");
        b.score  = _score;
        b.status = BidStatus.UnderReview;
        emit BidEvaluated(_bidId, _score);
    }

    /**
     * @dev Award the tender to a specific bid. Automatically creates a contract.
     */
    function awardTender(uint256 _tenderId, uint256 _bidId) external returns (uint256) {
        Tender storage t = tenders[_tenderId];
        require(
            t.createdBy == msg.sender || users[msg.sender].role == UserRole.Admin,
            "TM: Not authorized"
        );
        require(t.status == TenderStatus.Closed,   "TM: Tender must be closed");
        require(bids[_bidId].tenderId == _tenderId, "TM: Bid not for this tender");
        require(bids[_bidId].status == BidStatus.UnderReview ||
                bids[_bidId].status == BidStatus.Submitted,  "TM: Invalid bid status");

        // Accept winning, reject others
        uint256[] storage bidList = tenderBids[_tenderId];
        for (uint i = 0; i < bidList.length; i++) {
            if (bidList[i] == _bidId) {
                bids[bidList[i]].status = BidStatus.Accepted;
            } else {
                bids[bidList[i]].status = BidStatus.Rejected;
            }
        }

        t.status       = TenderStatus.Awarded;
        t.winningBidId = _bidId;

        // Auto-create contract
        contractCount++;
        contracts[contractCount] = Contract({
            contractId  : contractCount,
            tenderId    : _tenderId,
            bidId       : _bidId,
            tenderer    : t.createdBy,
            contractor  : bids[_bidId].bidder,
            value       : bids[_bidId].amount,
            terms       : t.requirements,
            status      : ContractStatus.Active,
            createdAt   : block.timestamp,
            completedAt : 0
        });
        tenderContract[_tenderId] = contractCount;

        emit TenderAwarded(_tenderId, _bidId, bids[_bidId].bidder);
        emit ContractCreated(contractCount, _tenderId);
        return contractCount;
    }

    function getBid(uint256 _id) external view returns (Bid memory) {
        return bids[_id];
    }

    function getTenderBids(uint256 _tenderId) external view returns (uint256[] memory) {
        return tenderBids[_tenderId];
    }

    function getUserBids(address _addr) external view returns (uint256[] memory) {
        return userBids[_addr];
    }

    // ===========================
    //    CONTRACT MANAGEMENT
    // ===========================

    /**
     * @dev Tenderer marks the contract as completed.
     */
    function completeContract(uint256 _contractId) external {
        Contract storage c = contracts[_contractId];
        require(c.contractId != 0,              "TM: Contract does not exist");
        require(
            c.tenderer == msg.sender || users[msg.sender].role == UserRole.Admin,
            "TM: Not authorized"
        );
        require(c.status == ContractStatus.Active, "TM: Contract not active");
        c.status      = ContractStatus.Completed;
        c.completedAt = block.timestamp;
        tenders[c.tenderId].status = TenderStatus.Completed;
        emit ContractCompleted(_contractId);
    }

    /**
     * @dev Either party can raise a dispute.
     */
    function raiseDispute(uint256 _contractId) external {
        Contract storage c = contracts[_contractId];
        require(c.contractId != 0,                 "TM: Contract does not exist");
        require(
            c.tenderer == msg.sender || c.contractor == msg.sender,
            "TM: Not a party to this contract"
        );
        require(c.status == ContractStatus.Active, "TM: Contract not active");
        c.status = ContractStatus.Disputed;
        emit ContractDisputed(_contractId);
    }

    /**
     * @dev Admin resolves a disputed contract.
     */
    function resolveDispute(uint256 _contractId, bool _markCompleted) external onlyAdmin {
        Contract storage c = contracts[_contractId];
        require(c.contractId != 0,                   "TM: Contract does not exist");
        require(c.status == ContractStatus.Disputed,  "TM: Not disputed");
        if (_markCompleted) {
            c.status      = ContractStatus.Completed;
            c.completedAt = block.timestamp;
            tenders[c.tenderId].status = TenderStatus.Completed;
        } else {
            c.status = ContractStatus.Terminated;
            tenders[c.tenderId].status = TenderStatus.Cancelled;
        }
        emit DisputeResolved(_contractId, _markCompleted);
    }

    function getContract(uint256 _id) external view returns (Contract memory) {
        return contracts[_id];
    }

    function getAllContractIds() external view returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](contractCount);
        for (uint256 i = 0; i < contractCount; i++) ids[i] = i + 1;
        return ids;
    }

    function getTenderContractId(uint256 _tenderId) external view returns (uint256) {
        return tenderContract[_tenderId];
    }
}
