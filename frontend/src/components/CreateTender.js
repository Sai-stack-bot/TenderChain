import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { useWeb3, ROLES } from "../context/Web3Context";

export default function CreateTender() {
  const { contract, user, switchToHardhat } = useWeb3();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "", description: "", requirements: "",
    budget: "", deadlineDays: "7",
  });
  const [criteria, setCriteria] = useState(["Cost", "Timeline", "Technical Quality"]);
  const [newCrit,  setNewCrit]  = useState("");
  const [pending,  setPending]  = useState(false);

  if (!user?.isRegistered || (user.role !== ROLES.Tenderer && user.role !== ROLES.Admin)) {
    return (
      <div className="card" style={{maxWidth:480}}>
        <div className="alert alert-warning">
          Only registered Tenderers or Admins can create tenders.
        </div>
      </div>
    );
  }

  const set = (k) => (e) => setForm(f => ({...f, [k]: e.target.value}));

  const addCriterion = () => {
    const c = newCrit.trim();
    if (!c) return;
    if (criteria.includes(c)) { toast.warning("Criterion already added"); return; }
    setCriteria(prev => [...prev, c]);
    setNewCrit("");
  };

  const removeCriterion = (idx) => setCriteria(prev => prev.filter((_,i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.requirements || !form.budget) {
      toast.warning("Fill all required fields"); return;
    }
    if (criteria.length === 0) { toast.warning("Add at least one evaluation criterion"); return; }
    if (parseFloat(form.budget) <= 0) { toast.warning("Budget must be positive"); return; }

    setPending(true);
    try {
      await switchToHardhat();
      const budget   = ethers.parseEther(form.budget.toString());
      const deadline = Math.floor(Date.now() / 1000) + Number(form.deadlineDays) * 86400;
      const tx = await contract.createTender(
        form.title, form.description, form.requirements,
        budget, deadline, criteria
      );
      toast.info("Transaction submitted, waiting for confirmation…");
      const receipt = await tx.wait();
      toast.success("Tender created successfully!");

      const event = receipt.logs.find(l => {
        try { return contract.interface.parseLog(l)?.name === "TenderCreated"; } catch { return false; }
      });
      if (event) {
        const parsed = contract.interface.parseLog(event);
        navigate(`/tenders/${parsed.args.tenderId.toString()}`);
      } else {
        navigate("/tenders");
      }
    } catch(e) {
      toast.error(e.reason || e.message || "Transaction failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Create New Tender</h1>
        <p>Fill the form to publish a tender on the blockchain.</p>
      </div>
      <div style={{maxWidth: 760}}>
        <form className="card" onSubmit={handleSubmit}>
          <div className="card-header">
            <h2>Tender Information</h2>
            <p>All data is stored immutably on the Ethereum blockchain.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Title <span>*</span></label>
            <input className="form-control" value={form.title} onChange={set("title")}
              placeholder="e.g. Road Construction Project Phase 2" required />
          </div>
          <div className="form-group">
            <label className="form-label">Description <span>*</span></label>
            <textarea className="form-control" rows={3} value={form.description} onChange={set("description")}
              placeholder="Detailed description of the project and its scope…" required />
          </div>
          <div className="form-group">
            <label className="form-label">Requirements <span>*</span></label>
            <textarea className="form-control" rows={3} value={form.requirements} onChange={set("requirements")}
              placeholder="Materials, certifications, compliance requirements…" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Budget (ETH) <span>*</span></label>
              <input className="form-control" type="number" step="0.001" min="0.001"
                value={form.budget} onChange={set("budget")}
                placeholder="e.g. 10.5" required />
              <p className="form-hint">Maximum bid amount bidders can offer.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Deadline (Days from now) <span>*</span></label>
              <input className="form-control" type="number" min="1" max="365"
                value={form.deadlineDays} onChange={set("deadlineDays")} required />
              <p className="form-hint">Bids won't be accepted after this deadline.</p>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Evaluation Criteria <span>*</span></label>
            <div className="flex gap-1 mb-1">
              <input className="form-control" value={newCrit} onChange={e=>setNewCrit(e.target.value)}
                placeholder="Add criterion (e.g. Experience, Quality)…"
                onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addCriterion(); }}} />
              <button type="button" onClick={addCriterion} className="btn btn-secondary">Add</button>
            </div>
            <div className="criteria-list">
              {criteria.map((c,i) => (
                <span key={i} className="badge badge-blue" style={{cursor:"pointer",gap:".4rem"}}>
                  {c}
                  <span onClick={()=>removeCriterion(i)} style={{fontWeight:700,color:"var(--danger)"}}>×</span>
                </span>
              ))}
            </div>
            {criteria.length === 0 && <p className="form-hint" style={{color:"var(--danger)"}}>At least one criterion required.</p>}
          </div>
          <hr className="divider" />
          <div className="flex gap-1 flex-wrap">
            <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
              {pending ? "Publishing to Blockchain…" : "Publish Tender"}
            </button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={()=>navigate("/tenders")} disabled={pending}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
