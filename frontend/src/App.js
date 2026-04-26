import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

import { Web3Provider, useWeb3 } from "./context/Web3Context";
import Navbar        from "./components/Navbar";
import ConnectWallet from "./components/ConnectWallet";
import Dashboard     from "./components/Dashboard";
import TenderList    from "./components/TenderList";
import TenderDetail  from "./components/TenderDetail";
import CreateTender  from "./components/CreateTender";
import MyBids        from "./components/MyBids";
import Contracts     from "./components/Contracts";
import Register      from "./components/Register";
import Admin         from "./components/Admin";

function AppRoutes() {
  const { connected, loading } = useWeb3();

  if (loading) return (
    <div className="spinner-wrap" style={{ minHeight: "100vh" }}>
      <div className="spinner" />
    </div>
  );

  if (!connected) return <ConnectWallet />;

  return (
    <div className="layout">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/"               element={<Dashboard />} />
          <Route path="/tenders"        element={<TenderList />} />
          <Route path="/tenders/:id"    element={<TenderDetail />} />
          <Route path="/create-tender"  element={<CreateTender />} />
          <Route path="/my-bids"        element={<MyBids />} />
          <Route path="/contracts"      element={<Contracts />} />
          <Route path="/register"       element={<Register />} />
          <Route path="/admin"          element={<Admin />} />
          <Route path="*"               element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Web3Provider>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer position="bottom-right" theme="colored" autoClose={4000} />
      </BrowserRouter>
    </Web3Provider>
  );
}
