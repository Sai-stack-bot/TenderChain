import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { useWeb3, ROLES, TENDER_STATUS, BID_STATUS, CONTRACT_STATUS } from "../context/Web3Context";

const tsBadge = { 0:"badge-blue",1:"badge-yellow",2:"badge-purple",3:"badge-green",4:"badge-red" };
const bidBadge = { 0:"badge-blue",1:"badge-yellow",2:"badge-green",3:"badge-red" };

const shortAddr = a => `${a.slice(0,8)}…${a.slice(-4)}`;

export default function TenderDetail() {
  const { id }             = useParams();
  const navigate           = useNavigate();
  const { contract, user, account, switchToHardhat } = useWeb3();

  const [tender,   setTender]   = useState(null);
  const [bids,     setBids]     = useState([]);
  const [contract_, setContract_] = useState(null);
  const [criteria, setCriteria] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [txPending,setTxPending]= useState(false);

  // Bid form
  const [bidForm, setBidForm] = useState({ amount:"", proposal:"", technical:"", days:"" });
  // Score map
  const [scores, setScores] = useState({});

  const load = useCallback(async () => {
    if (!contract) return;
    try {
      const t   = await contract.getTender(id);
      if (!t || t.tenderId.toString() === "0") { toast.error("Tender not found"); navigate("/tenders"); return; }
      const cr  = await contract.getTenderEvaluationCriteria(id);
      const bidIds = await contract.getTenderBids(id);
      const bidList = await Promise.all(bidIds.map(bid => contract.getBid(bid)));

      let ctr = null;
      const cid = await contract.getTenderContractId(id);
      if (Number(cid) > 0) ctr = await contract.getContract(cid);

      setTender(t);
      setCriteria(cr);
      setBids(bidList);
      setContract_(ctr);
    } catch(e){ console.error(e); toast.error("Failed to load tender"); }
    finally { setLoading(false); }
  }, [contract, id, navigate]);

  useEffect(() => { load(); }, [load]);

  const isOwner = tender && account?.toLowerCase() === tender.createdBy?.toLowerCase();
  const isAdmin = user?.role === ROLES.Admin;
  const isBidder = user?.role === ROLES.Bidder;
  const myBid = bids.find(b => b.bidder?.toLowerCase() === account?.toLowerCase());

  // ---- Actions ----
  const handleCloseTender = async () => {
    setTxPending(true);
    try {
      await switchToHardhat();
      const tx = await contract.closeTender(id);
      toast.info("Transaction submitted, waiting…");
      await tx.wait();
      toast.success("Tender closed!");
      load();
    } catch(e){ toast.error(e.reason || e.message); }
    finally { setTxPending(false); }
  };

  const handleCancelTender = async () => {
    if (!window.confirm("Cancel this tender? All bids will be rejected.")) return;
    setTxPending(true);
    try {
      await switchToHardhat();
      const tx = await contract.cancelTender(id);
      await tx.wait();
      toast.success("Tender cancelled");
      load();
    } catch(e){ toast.error(e.reason || e.message); }
    finally { setTxPending(false); }
  };

  const handleSubmitBid = async (e) => {
    e.preventDefault();
    if (!bidForm.amount || !bidForm.proposal || !bidForm.technical || !bidForm.days) {
      toast.warning("Fill all bid fields"); return;
    }
    setTxPending(true);
    try {
      const amt = ethers.parseEther(bidForm.amount.toString());
      await switchToHardhat();
      const tx = await contract.submitBid(id, amt, bidForm.proposal, bidForm.technical, Number(bidForm.days));
      toast.info("Submitting bid…");
      await tx.wait();
      toast.success("Bid submitted successfully!");
      setBidForm({ amount:"", proposal:"", technical:"", days:"" });
      load();
    } catch(e){ toast.error(e.reason || e.message); }
    finally { setTxPending(false); }
  };

  const handleEvaluateBid = async (bidId) => {
    const score = Number(scores[bidId]);
    if (isNaN(score) || score < 0 || score > 100) { toast.warning("Score must be 0-100"); return; }
    setTxPending(true);
    try {
      await switchToHardhat();
      const tx = await contract.evaluateBid(bidId, score);
      await tx.wait();
      toast.success(`Bid #${bidId} evaluated with score ${score}`);
      load();
    } catch(e){ toast.error(e.reason || e.message); }
    finally { setTxPending(false); }
  };

  const handleAwardTender = async (bidId) => {
    if (!window.confirm(`Award tender to Bid #${bidId}? A contract will be created automatically.`)) return;
    setTxPending(true);
    try {
      await switchToHardhat();
      const tx = await contract.awardTender(id, bidId);
      await tx.wait();
      toast.success("Tender awarded! Contract created.");
      load();
    } catch(e){ toast.error(e.reason || e.message); }
    finally { setTxPending(false); }
  };

  const handleCompleteContract = async () => {
    if (!contract_) return;
    setTxPending(true);
    try {
      await switchToHardhat();
      const tx = await contract.completeContract(contract_.contractId);
      await tx.wait();
      toast.success("Contract marked as completed!");
      load();
    } catch(e){ toast.error(e.reason || e.message); }
    finally { setTxPending(false); }
  };

  const handleRaiseDispute = async () => {
    if (!contract_) return;
    if (!window.confirm("Raise a dispute on this contract?")) return;
    setTxPending(true);
    try {
      await switchToHardhat();
      const tx = await contract.raiseDispute(contract_.contractId);
      await tx.wait();
      toast.success("Dispute raised");
      load();
    } catch(e){ toast.error(e.reason || e.message); }
    finally { setTxPending(false); }
  };

  const handleResolveDispute = async (markComplete) => {
    if (!contract_) return;
    setTxPending(true);
    try {
      await switchToHardhat();
      const tx = await contract.resolveDispute(contract_.contractId, markComplete);
      await tx.wait();
      toast.success(`Dispute resolved — ${markComplete?"Completed":"Terminated"}`);
      load();
    } catch(e){ toast.error(e.reason || e.message); }
    finally { setTxPending(false); }
  };

  if (loading) return <div className="spinner-wrap"><div className="spinner"/></div>;
  if (!tender) return null;

  const deadline   = new Date(Number(tender.deadline) * 1000);
  const createdAt  = new Date(Number(tender.createdAt) * 1000);
  const status     = Number(tender.status);
  const budgetEth  = parseFloat(tender.budget) / 1e18;

  return (
    <div>
      <div className="page-header flex-between flex-wrap gap-1">
        <div>
          <h1>{tender.title}</h1>
          <p>Tender #{tender.tenderId.toString()} · Created {createdAt.toLocaleDateString()}</p>
        </div>
        <div className="flex gap-1 flex-wrap">
          <span className={`badge ${tsBadge[status]}`} style={{fontSize:".85rem",padding:".3rem .75rem"}}>
            {TENDER_STATUS[status]}
          </span>
          {(isOwner || isAdmin) && status === 0 && (
            <>
              <button onClick={handleCloseTender} className="btn btn-warning btn-sm" disabled={txPending}>Close Tender</button>
              <button onClick={handleCancelTender} className="btn btn-danger btn-sm"  disabled={txPending}>Cancel</button>
            </>
          )}
        </div>
      </div>

      <div className="detail-grid">
        {/* LEFT COLUMN */}
        <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>

          {/* Info */}
          <div className="card">
            <div className="card-header"><h2>Tender Details</h2></div>
            <div className="info-row"><span className="label">Description</span><span className="value">{tender.description}</span></div>
            <div className="info-row"><span className="label">Requirements</span><span className="value">{tender.requirements}</span></div>
            <div className="info-row"><span className="label">Budget</span><span className="value">{budgetEth} ETH</span></div>
            <div className="info-row"><span className="label">Deadline</span><span className="value">{deadline.toLocaleString()}</span></div>
            <div className="info-row"><span className="label">Created By</span><span className="value">{shortAddr(tender.createdBy)}</span></div>
            <div className="info-row" style={{flexDirection:"column",gap:".5rem"}}>
              <span className="label">Evaluation Criteria</span>
              <div className="criteria-list">
                {criteria.map((c,i) => <span key={i} className="badge badge-blue">{c}</span>)}
              </div>
            </div>
          </div>

          {/* Contract Section */}
          {contract_ && (
            <div className="card">
              <div className="card-header"><h2>📜 Contract</h2></div>
              <div className="info-row"><span className="label">Contract ID</span><span className="value">#{contract_.contractId.toString()}</span></div>
              <div className="info-row"><span className="label">Value</span><span className="value">{parseFloat(contract_.value)/1e18} ETH</span></div>
              <div className="info-row"><span className="label">Tenderer</span><span className="value">{shortAddr(contract_.tenderer)}</span></div>
              <div className="info-row"><span className="label">Contractor</span><span className="value">{shortAddr(contract_.contractor)}</span></div>
              <div className="info-row"><span className="label">Terms</span><span className="value">{contract_.terms}</span></div>
              <div className="info-row"><span className="label">Status</span>
                <span className="value">
                  <span className={`badge ${["badge-gray","badge-blue","badge-green","badge-red","badge-red"][Number(contract_.status)]}`}>
                    {CONTRACT_STATUS[Number(contract_.status)]}
                  </span>
                </span>
              </div>
              <div className="info-row"><span className="label">Created</span><span className="value">{new Date(Number(contract_.createdAt)*1000).toLocaleString()}</span></div>
              {Number(contract_.completedAt) > 0 && (
                <div className="info-row"><span className="label">Completed</span><span className="value">{new Date(Number(contract_.completedAt)*1000).toLocaleString()}</span></div>
              )}
              {/* Contract actions */}
              <div className="flex gap-1 flex-wrap mt-2">
                {Number(contract_.status) === 1 && (isOwner || isAdmin) && (
                  <button onClick={handleCompleteContract} className="btn btn-success btn-sm" disabled={txPending}>✅ Mark Completed</button>
                )}
                {Number(contract_.status) === 1 && (
                  (account?.toLowerCase() === contract_.tenderer?.toLowerCase() ||
                   account?.toLowerCase() === contract_.contractor?.toLowerCase()) && (
                    <button onClick={handleRaiseDispute} className="btn btn-danger btn-sm" disabled={txPending}>⚠️ Raise Dispute</button>
                  )
                )}
                {Number(contract_.status) === 3 && isAdmin && (
                  <>
                    <button onClick={()=>handleResolveDispute(true)}  className="btn btn-success btn-sm" disabled={txPending}>Resolve: Complete</button>
                    <button onClick={()=>handleResolveDispute(false)} className="btn btn-danger btn-sm"  disabled={txPending}>Resolve: Terminate</button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Bids Section */}
          <div className="card">
            <div className="card-header"><h2>📨 Bids ({bids.length})</h2></div>
            {bids.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3>No bids yet</h3>
                <p>Be the first to submit a bid.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Bidder</th>
                      <th>Amount (ETH)</th>
                      <th>Days</th>
                      <th>Score</th>
                      <th>Status</th>
                      {(isOwner || isAdmin) && status === 1 && <th>Evaluate</th>}
                      {(isOwner || isAdmin) && status === 1 && <th>Award</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {bids.map(b => (
                      <tr key={b.bidId.toString()}
                        style={tender.winningBidId?.toString()===b.bidId?.toString()
                          ? {background:"#f0fdf4"} : {}}>
                        <td>{b.bidId.toString()}</td>
                        <td>
                          <span title={b.bidder}>{shortAddr(b.bidder)}</span>
                          {b.bidder?.toLowerCase()===account?.toLowerCase() && (
                            <span className="badge badge-teal" style={{marginLeft:".4rem",fontSize:".7rem"}}>You</span>
                          )}
                        </td>
                        <td>{parseFloat(b.amount)/1e18}</td>
                        <td>{b.deliveryDays.toString()}</td>
                        <td>{b.score.toString()}/100</td>
                        <td><span className={`badge ${bidBadge[Number(b.status)]}`}>{BID_STATUS[Number(b.status)]}</span></td>
                        {(isOwner || isAdmin) && status === 1 && (
                          <td>
                            <div className="flex gap-1" style={{alignItems:"center"}}>
                              <input type="number" min="0" max="100"
                                className="form-control score-input"
                                value={scores[b.bidId.toString()] || ""}
                                onChange={e => setScores(s => ({...s,[b.bidId.toString()]:e.target.value}))}
                                placeholder="0-100"
                              />
                              <button onClick={()=>handleEvaluateBid(b.bidId)} className="btn btn-info btn-sm" disabled={txPending}>Set</button>
                            </div>
                          </td>
                        )}
                        {(isOwner || isAdmin) && status === 1 && (
                          <td>
                            <button onClick={()=>handleAwardTender(b.bidId)} className="btn btn-success btn-sm" disabled={txPending}>
                              🏆 Award
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>

          {/* Bid proposal viewer */}
          {bids.length > 0 && (
            <div className="card">
              <div className="card-header"><h2>📄 Proposals</h2></div>
              {bids.map(b => (
                <div key={b.bidId.toString()} style={{marginBottom:"1rem",paddingBottom:"1rem",borderBottom:"1px solid var(--border)"}}>
                  <div className="flex-between mb-1">
                    <span style={{fontWeight:600,fontSize:".875rem"}}>Bid #{b.bidId.toString()}</span>
                    <span className={`badge ${bidBadge[Number(b.status)]}`}>{BID_STATUS[Number(b.status)]}</span>
                  </div>
                  <p style={{fontSize:".82rem",color:"var(--text-muted)",marginBottom:".4rem"}}><strong>Proposal:</strong> {b.proposal}</p>
                  <p style={{fontSize:".82rem",color:"var(--text-muted)"}}><strong>Technical:</strong> {b.technicalDetails}</p>
                </div>
              ))}
            </div>
          )}

          {/* Submit Bid Form */}
          {isBidder && user?.isRegistered && status === 0 && !myBid && (
            <div className="card">
              <div className="card-header">
                <h2>Submit Your Bid</h2>
                <p>Budget: {budgetEth} ETH · Deadline: {deadline.toLocaleDateString()}</p>
              </div>
              <form onSubmit={handleSubmitBid}>
                <div className="form-group">
                  <label className="form-label">Bid Amount (ETH) <span>*</span></label>
                  <input className="form-control" type="number" step="0.001" min="0.001" max={budgetEth}
                    value={bidForm.amount} onChange={e=>setBidForm(f=>({...f,amount:e.target.value}))}
                    placeholder={`Max ${budgetEth} ETH`} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Proposal <span>*</span></label>
                  <textarea className="form-control" rows={3}
                    value={bidForm.proposal} onChange={e=>setBidForm(f=>({...f,proposal:e.target.value}))}
                    placeholder="Describe your approach and value proposition…" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Technical Details <span>*</span></label>
                  <textarea className="form-control" rows={3}
                    value={bidForm.technical} onChange={e=>setBidForm(f=>({...f,technical:e.target.value}))}
                    placeholder="Tech stack, methodology, team qualifications…" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Delivery Days <span>*</span></label>
                  <input className="form-control" type="number" min="1"
                    value={bidForm.days} onChange={e=>setBidForm(f=>({...f,days:e.target.value}))}
                    placeholder="e.g. 90" required />
                </div>
                <button type="submit" className="btn btn-success btn-block" disabled={txPending}>
                  {txPending ? "Submitting…" : "Submit Bid"}
                </button>
              </form>
            </div>
          )}

          {myBid && (
            <div className="alert alert-success">
              ✅ You have already submitted a bid (#{ myBid.bidId.toString()}) for this tender.
              <br/>Status: <strong>{BID_STATUS[Number(myBid.status)]}</strong>
              {Number(myBid.score) > 0 && <> · Score: <strong>{myBid.score.toString()}/100</strong></>}
            </div>
          )}

          {!user?.isRegistered && status === 0 && (
            <div className="alert alert-warning">
              Register as a Bidder to submit bids.
            </div>
          )}

          {user?.isRegistered && user.role !== ROLES.Bidder && user.role !== ROLES.Admin && !isOwner && (
            <div className="alert alert-info">
              Only registered Bidders can submit bids.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
