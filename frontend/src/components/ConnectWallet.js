import React from "react";
import { useWeb3 } from "../context/Web3Context";

export default function ConnectWallet() {
  const { connect, loading } = useWeb3();

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div className="logo">🔗</div>
        <h1>TenderChain</h1>
        <p>
          A transparent, tamper-proof Blockchain-Based Tender &amp; Contract Management
          System powered by Ethereum Smart Contracts.
        </p>

        <div className="features-list">
          <div className="feature-item"><span className="fi">📋</span> Create Tenders</div>
          <div className="feature-item"><span className="fi">📨</span> Submit Bids</div>
          <div className="feature-item"><span className="fi">⚖️</span> Evaluate &amp; Award</div>
          <div className="feature-item"><span className="fi">📜</span> Auto Contracts</div>
          <div className="feature-item"><span className="fi">🔒</span> Immutable Records</div>
          <div className="feature-item"><span className="fi">🛡️</span> Role-Based Access</div>
        </div>

        <button className="btn btn-primary btn-block btn-lg" onClick={connect} disabled={loading}>
          {loading ? "Connecting…" : "🦊 Connect with MetaMask"}
        </button>

        <p style={{ marginTop: "1rem", fontSize: ".78rem", color: "#94a3b8" }}>
          Requires MetaMask · Hardhat Local Network (Chain ID 31337)
        </p>
      </div>
    </div>
  );
}
