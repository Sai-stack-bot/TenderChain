import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWeb3, ROLES, TENDER_STATUS } from "../context/Web3Context";

const statusColor = { 0:"badge-blue",1:"badge-yellow",2:"badge-purple",3:"badge-green",4:"badge-red" };

export default function TenderList() {
  const { contract, user } = useWeb3();
  const [tenders,  setTenders]  = useState([]);
  const [filter,   setFilter]   = useState("all");
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!contract) return;
    (async () => {
      try {
        const ids = await contract.getAllTenderIds();
        const list = await Promise.all(ids.map(id => contract.getTender(id)));
        setTenders([...list].reverse());
      } catch(e){ console.error(e); }
      finally { setLoading(false); }
    })();
  }, [contract]);

  const filtered = filter === "all"
    ? tenders
    : tenders.filter(t => TENDER_STATUS[Number(t.status)].toLowerCase() === filter);

  if (loading) return <div className="spinner-wrap"><div className="spinner"/></div>;

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h1>All Tenders</h1>
          <p>Browse and interact with tenders on the blockchain</p>
        </div>
        {(user?.role === ROLES.Tenderer || user?.role === ROLES.Admin) && user?.isRegistered && (
          <Link to="/create-tender" className="btn btn-primary">+ New Tender</Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-1 flex-wrap mb-2">
        {["all","open","closed","awarded","completed","cancelled"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter===f ? "btn-primary" : "btn-secondary"}`}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No tenders found</h3>
            <p>No tenders match the selected filter.</p>
          </div>
        </div>
      ) : (
        <div className="tender-grid">
          {filtered.map(t => {
            const deadline = new Date(Number(t.deadline) * 1000);
            const expired  = deadline < new Date();
            return (
              <div className="tender-card" key={t.tenderId.toString()}>
                <div className="flex-between">
                  <span className={`badge ${statusColor[Number(t.status)]}`}>
                    {TENDER_STATUS[Number(t.status)]}
                  </span>
                  <span className="text-muted" style={{fontSize:".78rem"}}>#{t.tenderId.toString()}</span>
                </div>
                <h3>{t.title}</h3>
                <p style={{fontSize:".82rem",color:"var(--text-muted)",overflow:"hidden",
                  display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                  {t.description}
                </p>
                <div className="meta">
                  <span>💰 {parseFloat(t.budget) / 1e18} ETH</span>
                  <span>📅 {expired?"Expired ":"Due "}{deadline.toLocaleDateString()}</span>
                </div>
                <div className="actions">
                  <Link to={`/tenders/${t.tenderId}`} className="btn btn-primary btn-sm">View Details</Link>
                  {Number(t.status) === 0 && user?.role === ROLES.Bidder && user?.isRegistered && (
                    <Link to={`/tenders/${t.tenderId}`} className="btn btn-success btn-sm">Submit Bid</Link>
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
