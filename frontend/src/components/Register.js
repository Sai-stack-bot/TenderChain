import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useWeb3, ROLES, ROLE_NAMES } from "../context/Web3Context";

export default function Register() {
  const { contract, user, refreshUser, account, switchToHardhat } = useWeb3();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:"", organization:"", role: ROLES.Bidder });
  const [pending, setPending] = useState(false);

  if (user?.isRegistered) {
    return (
      <div style={{maxWidth:480}}>
        <div className="card">
          <div className="card-header"><h2>Already Registered</h2></div>
          <div className="alert alert-success">
            You are registered as <strong>{ROLE_NAMES[user.role]}</strong> ({user.name}).<br/>
            Organization: {user.organization}
          </div>
          <button className="btn btn-primary mt-2" onClick={()=>navigate("/")}>Go to Dashboard</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.organization.trim()) { toast.warning("Fill all fields"); return; }
    setPending(true);
    try {
      await switchToHardhat();
      const tx = await contract.selfRegister(form.name, form.organization, Number(form.role));
      toast.info("Registering on blockchain…");
      await tx.wait();
      await refreshUser();
      toast.success("Registered successfully!");
      navigate("/");
    } catch(e){ toast.error(e.reason || e.message); }
    finally { setPending(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Register Account</h1>
        <p>Register your wallet address on the blockchain to participate in tenders.</p>
      </div>
      <div style={{maxWidth:520}}>
        <div className="card">
          <div className="card-header">
            <h2>Create Your Profile</h2>
            <p>Wallet: <code style={{fontSize:".8rem",background:"#f1f5f9",padding:".15rem .4rem",borderRadius:4}}>{account}</code></p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name <span>*</span></label>
              <input className="form-control" value={form.name}
                onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                placeholder="e.g. John Smith" required />
            </div>
            <div className="form-group">
              <label className="form-label">Organization <span>*</span></label>
              <input className="form-control" value={form.organization}
                onChange={e=>setForm(f=>({...f,organization:e.target.value}))}
                placeholder="e.g. ABC Construction Ltd." required />
            </div>
            <div className="form-group">
              <label className="form-label">Role <span>*</span></label>
              <select className="form-control" value={form.role}
                onChange={e=>setForm(f=>({...f,role:Number(e.target.value)}))}>
                <option value={ROLES.Tenderer}>Tenderer — Create and manage tenders</option>
                <option value={ROLES.Bidder}>Bidder — Submit bids on tenders</option>
              </select>
              <p className="form-hint">
                {Number(form.role)===ROLES.Tenderer
                  ? "Create tenders, evaluate bids, and award contracts."
                  : "Browse open tenders and submit competitive bids."}
              </p>
            </div>
            <hr className="divider"/>
            <div className="form-row" style={{marginBottom:"1rem"}}>
              <div style={{padding:".85rem",borderRadius:"var(--radius)",cursor:"pointer",
                border:Number(form.role)===ROLES.Tenderer?"2px solid var(--primary)":"1px solid var(--border)",
                background:Number(form.role)===ROLES.Tenderer?"var(--primary-light)":"var(--surface)"
              }} onClick={()=>setForm(f=>({...f,role:ROLES.Tenderer}))}>
                <div style={{fontWeight:600,marginBottom:".3rem"}}>Tenderer</div>
                <ul style={{fontSize:".78rem",color:"var(--text-muted)",paddingLeft:"1rem"}}>
                  <li>Create &amp; publish tenders</li>
                  <li>Evaluate bids &amp; award contracts</li>
                  <li>Mark contracts complete</li>
                </ul>
              </div>
              <div style={{padding:".85rem",borderRadius:"var(--radius)",cursor:"pointer",
                border:Number(form.role)===ROLES.Bidder?"2px solid var(--secondary)":"1px solid var(--border)",
                background:Number(form.role)===ROLES.Bidder?"#ccfbf1":"var(--surface)"
              }} onClick={()=>setForm(f=>({...f,role:ROLES.Bidder}))}>
                <div style={{fontWeight:600,marginBottom:".3rem"}}>Bidder</div>
                <ul style={{fontSize:".78rem",color:"var(--text-muted)",paddingLeft:"1rem"}}>
                  <li>Browse open tenders</li>
                  <li>Submit competitive bids</li>
                  <li>Track bid status</li>
                </ul>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={pending}>
              {pending ? "Registering on Blockchain…" : "Register Now"}
            </button>
          </form>
        </div>
        <div className="alert alert-info mt-2">
          Your registration is stored permanently on the blockchain. Role cannot be changed after registration.
        </div>
      </div>
    </div>
  );
}
