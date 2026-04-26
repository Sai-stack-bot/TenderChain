import React from "react";
import { NavLink } from "react-router-dom";
import { useWeb3, ROLES, ROLE_NAMES } from "../context/Web3Context";

const shortAddr = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";

export default function Navbar() {
  const { account, user } = useWeb3();

  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-brand">
        <span>🔗</span> TenderChain
      </NavLink>

      <div className="navbar-nav">
        <NavLink to="/"              className={({isActive})=>`nav-link${isActive?" active":""}`} end>Dashboard</NavLink>
        <NavLink to="/tenders"       className={({isActive})=>`nav-link${isActive?" active":""}`}>Tenders</NavLink>

        {user?.isRegistered && (user.role === ROLES.Tenderer || user.role === ROLES.Admin) && (
          <NavLink to="/create-tender" className={({isActive})=>`nav-link${isActive?" active":""}`}>+ Create</NavLink>
        )}

        {user?.isRegistered && user.role === ROLES.Bidder && (
          <NavLink to="/my-bids" className={({isActive})=>`nav-link${isActive?" active":""}`}>My Bids</NavLink>
        )}

        <NavLink to="/contracts" className={({isActive})=>`nav-link${isActive?" active":""}`}>Contracts</NavLink>

        {user?.isRegistered && user.role === ROLES.Admin && (
          <NavLink to="/admin" className={({isActive})=>`nav-link${isActive?" active":""}`}>Admin</NavLink>
        )}

        {!user?.isRegistered && (
          <NavLink to="/register" className={({isActive})=>`nav-link${isActive?" active":""}`}>Register</NavLink>
        )}
      </div>

      <div className="navbar-right">
        {user?.isRegistered && (
          <span className="badge badge-purple" style={{fontSize:".72rem"}}>
            {ROLE_NAMES[user.role]}
          </span>
        )}
        <div className="account-chip">
          <span className="dot" />
          {shortAddr(account)}
        </div>
      </div>
    </nav>
  );
}
