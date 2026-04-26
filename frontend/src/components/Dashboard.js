import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWeb3, ROLES, ROLE_NAMES, TENDER_STATUS } from "../context/Web3Context";

const statusColor = { 0:"badge-blue", 1:"badge-yellow", 2:"badge-purple", 3:"badge-green", 4:"badge-red" };

export default function Dashboard() {
  const { contract, user, account } = useWeb3();
  const [stats,   setStats]   = useState({ total:0, open:0, awarded:0, completed:0 });
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contract) return;
    (async () => {
      try {
        const ids = await contract.getAllTenderIds();
        const tenders = await Promise.all(ids.map(id => contract.getTender(id)));
        const st = { total: tenders.length, open: 0, awarded: 0, completed: 0 };
        tenders.forEach(t => {
          if (Number(t.status) === 0) st.open++;
          if (Number(t.status) === 2) st.awarded++;
          if (Number(t.status) === 3) st.completed++;
        });
        setStats(st);
        setRecent([...tenders].reverse().slice(0, 6));
      } catch(e){ console.error(e); }
      finally { setLoading(false); }
    })();
  }, [contract]);

  if (loading) return <div className="spinner-wrap"><div className="spinner"/></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Welcome{user?.isRegistered ? `, ${user.name}` : ""}! 👋</h1>
        <p>
          {user?.isRegistered
            ? `Logged in as ${ROLE_NAMES[user.role]} · ${user.organization}`
            : <span>You are not registered. <Link to="/register">Register now</Link> to participate.</span>
          }
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Tenders</span>
          <span className="stat-value">{stats.total}</span>
          <span className="stat-desc">All time</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Open Tenders</span>
          <span className="stat-value" style={{color:"var(--info)"}}>{stats.open}</span>
          <span className="stat-desc">Accepting bids</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Awarded</span>
          <span className="stat-value" style={{color:"var(--accent)"}}>{stats.awarded}</span>
          <span className="stat-desc">Contracts active</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Completed</span>
          <span className="stat-value" style={{color:"var(--success)"}}>{stats.completed}</span>
          <span className="stat-desc">Successfully closed</span>
        </div>
      </div>

      {!user?.isRegistered && (
        <div className="alert alert-warning mb-2">
          ⚠️ You must <Link to="/register"><strong>register</strong></Link> before creating tenders or submitting bids.
        </div>
      )}

      <div className="card">
        <div className="card-header flex-between">
          <div>
            <h2>Recent Tenders</h2>
            <p>Latest tender requests on the blockchain</p>
          </div>
          <Link to="/tenders" className="btn btn-secondary btn-sm">View All</Link>
        </div>

        {recent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No tenders yet</h3>
            <p>Tenders created on the blockchain will appear here.</p>
            {(user?.role === ROLES.Tenderer || user?.role === ROLES.Admin) && (
              <Link to="/create-tender" className="btn btn-primary mt-2">Create First Tender</Link>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Budget (ETH)</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(t => (
                  <tr key={t.tenderId.toString()}>
                    <td>#{t.tenderId.toString()}</td>
                    <td><strong>{t.title}</strong></td>
                    <td>{parseFloat(t.budget) / 1e18} ETH</td>
                    <td>{new Date(Number(t.deadline) * 1000).toLocaleDateString()}</td>
                    <td><span className={`badge ${statusColor[Number(t.status)]}`}>{TENDER_STATUS[Number(t.status)]}</span></td>
                    <td><Link to={`/tenders/${t.tenderId}`} className="btn btn-secondary btn-sm">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
