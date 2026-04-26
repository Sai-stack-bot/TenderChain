import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWeb3, ROLES, BID_STATUS, TENDER_STATUS } from "../context/Web3Context";

const bidBadge    = { 0:"badge-blue",1:"badge-yellow",2:"badge-green",3:"badge-red" };
const tenderBadge = { 0:"badge-blue",1:"badge-yellow",2:"badge-purple",3:"badge-green",4:"badge-red" };

export default function MyBids() {
  const { contract, user, account } = useWeb3();
  const [bids,    setBids]    = useState([]);
  const [tenders, setTenders] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contract || !account) return;
    (async () => {
      try {
        const bidIds = await contract.getUserBids(account);
        const bidList = await Promise.all(bidIds.map(id => contract.getBid(id)));

        // Fetch associated tenders
        const tenderMap = {};
        for (const b of bidList) {
          const tid = b.tenderId.toString();
          if (!tenderMap[tid]) {
            tenderMap[tid] = await contract.getTender(b.tenderId);
          }
        }
        setBids([...bidList].reverse());
        setTenders(tenderMap);
      } catch(e){ console.error(e); }
      finally { setLoading(false); }
    })();
  }, [contract, account]);

  if (!user?.isRegistered || user.role !== ROLES.Bidder) {
    return (
      <div className="card" style={{maxWidth:480}}>
        <div className="alert alert-warning">Only registered Bidders can view this page.</div>
      </div>
    );
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner"/></div>;

  return (
    <div>
      <div className="page-header">
        <h1>My Bids</h1>
        <p>Track all bids you have submitted on the blockchain.</p>
      </div>

      {bids.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No bids submitted yet</h3>
            <p>Browse open tenders and submit your first bid.</p>
            <Link to="/tenders" className="btn btn-primary mt-2">Browse Tenders</Link>
          </div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
          {bids.map(b => {
            const t = tenders[b.tenderId.toString()];
            return (
              <div className="card" key={b.bidId.toString()}>
                <div className="flex-between flex-wrap gap-1 mb-1">
                  <div>
                    <span style={{fontWeight:700,fontSize:"1rem"}}>
                      {t ? t.title : `Tender #${b.tenderId.toString()}`}
                    </span>
                    <span className="text-muted" style={{marginLeft:".5rem",fontSize:".8rem"}}>
                      Tender #{b.tenderId.toString()} · Bid #{b.bidId.toString()}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {t && <span className={`badge ${tenderBadge[Number(t.status)]}`}>{TENDER_STATUS[Number(t.status)]}</span>}
                    <span className={`badge ${bidBadge[Number(b.status)]}`}>{BID_STATUS[Number(b.status)]}</span>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:".75rem",fontSize:".875rem"}}>
                  <div>
                    <span className="text-muted">Bid Amount</span>
                    <p style={{fontWeight:600}}>{parseFloat(b.amount)/1e18} ETH</p>
                  </div>
                  <div>
                    <span className="text-muted">Delivery</span>
                    <p style={{fontWeight:600}}>{b.deliveryDays.toString()} days</p>
                  </div>
                  <div>
                    <span className="text-muted">Score</span>
                    <p style={{fontWeight:600}}>
                      {Number(b.score) > 0 ? `${b.score.toString()}/100` : "Not evaluated"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted">Submitted</span>
                    <p style={{fontWeight:600}}>{new Date(Number(b.submittedAt)*1000).toLocaleDateString()}</p>
                  </div>
                </div>

                <div style={{margin:".75rem 0",fontSize:".875rem"}}>
                  <span className="text-muted">Proposal: </span>{b.proposal}
                </div>

                {Number(b.status) === 2 && (
                  <div className="alert alert-success" style={{marginBottom:0}}>
                    🎉 Your bid was accepted! Check the <Link to={`/tenders/${b.tenderId}`}>tender page</Link> for contract details.
                  </div>
                )}

                <div className="mt-1">
                  <Link to={`/tenders/${b.tenderId}`} className="btn btn-secondary btn-sm">
                    View Tender
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
