import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { useWeb3, ROLES, ROLE_NAMES } from "../context/Web3Context";

export default function Admin() {
  const { contract, user, account, switchToHardhat } = useWeb3();
  const [form,    setForm]    = useState({ address:"", name:"", organization:"", role: ROLES.Tenderer });
  const [lookup,  setLookup]  = useState({ address:"", result:null });
  const [stats,   setStats]   = useState({ tenders:0, bids:0, contracts:0 });
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!contract) return;
    try {
      const t = await contract.tenderCount();
      const b = await contract.bidCount();
      const c = await contract.contractCount();
      setStats({ tenders:Number(t), bids:Number(b), contracts:Number(c) });
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [contract]);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (!user?.isRegistered || user.role !== ROLES.Admin) {
    return <div className="card" style={{maxWidth:480}}><div className="alert alert-danger">Access denied. Admin only.</div></div>;
  }

  const handleRegisterUser = async (e) => {
    e.preventDefault();
    if (!form.address || !form.name || !form.organization) { toast.warning("Fill all fields"); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(form.address)) { toast.warning("Invalid Ethereum address"); return; }
    setPending(true);
    try {
      await switchToHardhat();
      const tx = await contract.registerUserByAdmin(form.address, form.name, form.organization, Number(form.role));
      toast.info("Submitting transaction…");
      await tx.wait();
      toast.success(`${form.name} registered as ${ROLE_NAMES[Number(form.role)]}!`);
      setForm({ address:"", name:"", organization:"", role:ROLES.Tenderer });
    } catch(e){ toast.error(e.reason || e.message); }
    finally { setPending(false); }
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!lookup.address) return;
    try {
      const u = await contract.users(lookup.address);
      setLookup(l => ({...l, result:u}));
    } catch(e){ toast.error("Lookup failed"); }
  };

  return (
    <div>
      <div className="page-header"><h1>Admin Panel</h1><p>System administration and user management</p></div>

      <div className="stats-grid" style={{marginBottom:"1.5rem"}}>
        <div className="stat-card"><span className="stat-label">Total Tenders</span><span className="stat-value">{loading?"…":stats.tenders}</span></div>
        <div className="stat-card"><span className="stat-label">Total Bids</span><span className="stat-value" style={{color:"var(--info)"}}>{loading?"…":stats.bids}</span></div>
        <div className="stat-card"><span className="stat-label">Total Contracts</span><span className="stat-value" style={{color:"var(--success)"}}>{loading?"…":stats.contracts}</span></div>
        <div className="stat-card"><span className="stat-label">Admin Wallet</span><span style={{fontSize:".78rem",fontWeight:600,wordBreak:"break-all"}}>{account}</span></div>
      </div>

      <div className="form-row" style={{alignItems:"flex-start"}}>
        <div className="card">
          <div className="card-header"><h2>Register User</h2><p>Manually register a wallet address with a specific role.</p></div>
          <form onSubmit={handleRegisterUser}>
            <div className="form-group">
              <label className="form-label">Wallet Address <span>*</span></label>
              <input className="form-control" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="0x..." required/>
            </div>
            <div className="form-group">
              <label className="form-label">Full Name <span>*</span></label>
              <input className="form-control" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Jane Doe" required/>
            </div>
            <div className="form-group">
              <label className="form-label">Organization <span>*</span></label>
              <input className="form-control" value={form.organization} onChange={e=>setForm(f=>({...f,organization:e.target.value}))} placeholder="XYZ Corp." required/>
            </div>
            <div className="form-group">
              <label className="form-label">Role <span>*</span></label>
              <select className="form-control" value={form.role} onChange={e=>setForm(f=>({...f,role:Number(e.target.value)}))}>
                <option value={ROLES.Admin}>Admin</option>
                <option value={ROLES.Tenderer}>Tenderer</option>
                <option value={ROLES.Bidder}>Bidder</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={pending}>{pending?"Registering…":"Register User"}</button>
          </form>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
          <div className="card">
            <div className="card-header"><h2>User Lookup</h2><p>Query registration details for any wallet.</p></div>
            <form onSubmit={handleLookup}>
              <div className="form-group">
                <label className="form-label">Wallet Address</label>
                <input className="form-control" value={lookup.address} onChange={e=>setLookup(l=>({...l,address:e.target.value,result:null}))} placeholder="0x..."/>
              </div>
              <button type="submit" className="btn btn-secondary btn-block">Look Up</button>
            </form>
            {lookup.result && (
              <div style={{marginTop:"1rem"}}>
                <div className="info-row"><span className="label">Registered</span><span className="value">{lookup.result.isRegistered?<span className="badge badge-green">Yes</span>:<span className="badge badge-red">No</span>}</span></div>
                {lookup.result.isRegistered && (<>
                  <div className="info-row"><span className="label">Name</span><span className="value">{lookup.result.name}</span></div>
                  <div className="info-row"><span className="label">Organization</span><span className="value">{lookup.result.organization}</span></div>
                  <div className="info-row"><span className="label">Role</span><span className="value"><span className="badge badge-purple">{ROLE_NAMES[Number(lookup.result.role)]}</span></span></div>
                  <div className="info-row"><span className="label">Registered At</span><span className="value">{new Date(Number(lookup.result.registeredAt)*1000).toLocaleString()}</span></div>
                </>)}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header"><h2>Smart Contract Info</h2></div>
            <div className="info-row"><span className="label">Network</span><span className="value"><span className="badge badge-teal">Hardhat Local</span></span></div>
            <div className="info-row"><span className="label">Chain ID</span><span className="value">31337</span></div>
            <div className="info-row"><span className="label">Consensus</span><span className="value">Proof of Authority (Clique)</span></div>
            <div className="info-row"><span className="label">Language</span><span className="value">Solidity ^0.8.19</span></div>
            <div style={{marginTop:".75rem",fontSize:".78rem",color:"var(--text-muted)"}}>
              Address in <code>frontend/src/contracts/contract-address.json</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
