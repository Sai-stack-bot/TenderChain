import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useWeb3, ROLES, CONTRACT_STATUS } from "../context/Web3Context";

const cBadge   = ["badge-gray","badge-blue","badge-green","badge-red","badge-red"];
const shortAddr = a => `${a.slice(0,8)}…${a.slice(-4)}`;

export default function Contracts() {
  const { contract, user, account, switchToHardhat } = useWeb3();
  const [contracts, setContracts] = useState([]);
  const [tenders,   setTenders]   = useState({});
  const [loading,   setLoading]   = useState(true);
  const [txPending, setTxPending] = useState(false);

  const load = useCallback(async () => {
    if (!contract) return;
    try {
      const ids  = await contract.getAllContractIds();
      const list = await Promise.all(ids.map(id => contract.getContract(id)));
      const tMap = {};
      for (const c of list) {
        const tid = c.tenderId.toString();
        if (!tMap[tid]) tMap[tid] = await contract.getTender(c.tenderId);
      }
      setContracts([...list].reverse());
      setTenders(tMap);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [contract]);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async (contractId) => {
    setTxPending(true);
    try {
      await switchToHardhat();
      const tx = await contract.completeContract(contractId);
      await tx.wait();
      toast.success("Contract marked as completed!");
      load();
    } catch(e){ toast.error(e.reason || e.message); }
    finally { setTxPending(false); }
  };

  const handleDispute = async (contractId) => {
    if (!window.confirm("Raise a dispute on this contract?")) return;
    setTxPending(true);
    try {
      await switchToHardhat();
      const tx = await contract.raiseDispute(contractId);
      await tx.wait();
      toast.success("Dispute raised");
      load();
    } catch(e){ toast.error(e.reason || e.message); }
    finally { setTxPending(false); }
  };

  const handleResolve = async (contractId, markComplete) => {
    setTxPending(true);
    try {
      await switchToHardhat();
      const tx = await contract.resolveDispute(contractId, markComplete);
      await tx.wait();
      toast.success(`Dispute resolved — ${markComplete ? "Completed" : "Terminated"}`);
      load();
    } catch(e){ toast.error(e.reason || e.message); }
    finally { setTxPending(false); }
  };

  if (loading) return <div className="spinner-wrap"><div className="spinner"/></div>;

  const myContracts = user?.role === ROLES.Admin
    ? contracts
    : contracts.filter(c =>
        c.tenderer?.toLowerCase()   === account?.toLowerCase() ||
        c.contractor?.toLowerCase() === account?.toLowerCase()
      );

  return (
    <div>
      <div className="page-header">
        <h1>Contracts</h1>
        <p>{user?.role === ROLES.Admin ? "All contracts on the blockchain" : "Contracts you are a party to"}</p>
      </div>

      {myContracts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📜</div>
            <h3>No contracts yet</h3>
            <p>Contracts are auto-created when a tender is awarded.</p>
            <Link to="/tenders" className="btn btn-primary mt-2">Browse Tenders</Link>
          </div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
          {myContracts.map(c => {
            const tender     = tenders[c.tenderId.toString()];
            const isParty    = c.tenderer?.toLowerCase()   === account?.toLowerCase() ||
                               c.contractor?.toLowerCase() === account?.toLowerCase();
            const isTenderer = c.tenderer?.toLowerCase() === account?.toLowerCase();
            const status     = Number(c.status);
            return (
              <div className="card" key={c.contractId.toString()}>
                <div className="flex-between flex-wrap gap-1" style={{marginBottom:".75rem"}}>
                  <div>
                    <span style={{fontWeight:700,fontSize:"1rem"}}>📜 Contract #{c.contractId.toString()}</span>
                    {tender && <span className="text-muted" style={{marginLeft:".5rem",fontSize:".82rem"}}>— {tender.title}</span>}
                  </div>
                  <span className={`badge ${cBadge[status]}`} style={{fontSize:".8rem"}}>{CONTRACT_STATUS[status]}</span>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:".75rem",fontSize:".875rem",marginBottom:".85rem"}}>
                  <div><span className="text-muted">Value</span><p style={{fontWeight:600}}>{parseFloat(c.value)/1e18} ETH</p></div>
                  <div>
                    <span className="text-muted">Tenderer</span>
                    <p style={{fontWeight:600}} title={c.tenderer}>
                      {shortAddr(c.tenderer)}
                      {isTenderer && <span className="badge badge-teal" style={{marginLeft:".35rem",fontSize:".7rem"}}>You</span>}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted">Contractor</span>
                    <p style={{fontWeight:600}} title={c.contractor}>
                      {shortAddr(c.contractor)}
                      {c.contractor?.toLowerCase()===account?.toLowerCase() &&
                        <span className="badge badge-blue" style={{marginLeft:".35rem",fontSize:".7rem"}}>You</span>}
                    </p>
                  </div>
                  <div><span className="text-muted">Created</span><p style={{fontWeight:600}}>{new Date(Number(c.createdAt)*1000).toLocaleDateString()}</p></div>
                  {Number(c.completedAt)>0 && (
                    <div><span className="text-muted">Completed</span><p style={{fontWeight:600}}>{new Date(Number(c.completedAt)*1000).toLocaleDateString()}</p></div>
                  )}
                </div>

                <div style={{fontSize:".875rem",marginBottom:".85rem"}}>
                  <span className="text-muted">Terms: </span>{c.terms}
                </div>

                <div className="flex gap-1 flex-wrap">
                  <Link to={`/tenders/${c.tenderId}`} className="btn btn-secondary btn-sm">View Tender</Link>
                  {status === 1 && (isTenderer || user?.role === ROLES.Admin) && (
                    <button onClick={()=>handleComplete(c.contractId)} className="btn btn-success btn-sm" disabled={txPending}>
                      ✅ Mark Completed
                    </button>
                  )}
                  {status === 1 && isParty && (
                    <button onClick={()=>handleDispute(c.contractId)} className="btn btn-danger btn-sm" disabled={txPending}>
                      ⚠️ Raise Dispute
                    </button>
                  )}
                  {status === 3 && user?.role === ROLES.Admin && (
                    <>
                      <button onClick={()=>handleResolve(c.contractId,true)}  className="btn btn-success btn-sm" disabled={txPending}>Resolve: Complete</button>
                      <button onClick={()=>handleResolve(c.contractId,false)} className="btn btn-danger btn-sm"  disabled={txPending}>Resolve: Terminate</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
