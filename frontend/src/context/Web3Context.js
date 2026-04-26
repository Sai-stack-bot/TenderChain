import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import TenderManagementABI from "../contracts/TenderManagement.json";
import contractAddressFile from "../contracts/contract-address.json";

const Web3Context = createContext(null);

export const useWeb3 = () => {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used inside Web3Provider");
  return ctx;
};

export const ROLES = { None: 0, Admin: 1, Tenderer: 2, Bidder: 3 };
export const ROLE_NAMES = ["None", "Admin", "Tenderer", "Bidder"];
export const TENDER_STATUS   = ["Open", "Closed", "Awarded", "Completed", "Cancelled"];
export const BID_STATUS      = ["Submitted", "Under Review", "Accepted", "Rejected"];
export const CONTRACT_STATUS = ["Created", "Active", "Completed", "Disputed", "Terminated"];

const CONTRACT_ADDRESS = contractAddressFile.TenderManagement;
const HARDHAT_CHAIN_ID = "0x7A69"; // 31337

// Force MetaMask to switch to Hardhat Local
const switchToHardhat = async () => {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: HARDHAT_CHAIN_ID }],
    });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: HARDHAT_CHAIN_ID,
          chainName: "Hardhat Local",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["http://127.0.0.1:8545"],
        }],
      });
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HARDHAT_CHAIN_ID }],
      });
    }
  }
};

export function Web3Provider({ children }) {
  const [provider,  setProvider]  = useState(null);
  const [signer,    setSigner]    = useState(null);
  const [contract,  setContract]  = useState(null);
  const [account,   setAccount]   = useState(null);
  const [user,      setUser]      = useState(null);
  const [chainId,   setChainId]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [connected, setConnected] = useState(false);

  const loadUser = useCallback(async (ctr, addr) => {
    try {
      const u = await ctr.users(addr);
      setUser({
        address:      addr,
        name:         u.name,
        organization: u.organization,
        role:         Number(u.role),
        isRegistered: u.isRegistered,
      });
    } catch (e) {
      console.error("loadUser error", e);
    }
  }, []);

  // Build provider+signer+contract for the currently active MetaMask account
  const buildConnection = useCallback(async () => {
    const prov = new ethers.BrowserProvider(window.ethereum);
    const sign = await prov.getSigner();
    const addr = await sign.getAddress();
    const net  = await prov.getNetwork();
    const ctr  = new ethers.Contract(CONTRACT_ADDRESS, TenderManagementABI.abi, sign);
    setProvider(prov);
    setSigner(sign);
    setContract(ctr);
    setAccount(addr);
    setChainId(Number(net.chainId));
    setConnected(true);
    await loadUser(ctr, addr);
  }, [loadUser]);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert("MetaMask is not installed. Please install MetaMask to use this app.");
      return;
    }
    setLoading(true);
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await switchToHardhat();
      await buildConnection();
    } catch (e) {
      console.error("connect error", e);
    } finally {
      setLoading(false);
    }
  }, [buildConnection]);

  const refreshUser = useCallback(async () => {
    if (contract && account) await loadUser(contract, account);
  }, [contract, account, loadUser]);

  // When user switches account in MetaMask — auto-update everything
  useEffect(() => {
    if (!window.ethereum) return;

    const onAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        setConnected(false);
        setAccount(null);
        setUser(null);
        setSigner(null);
        setContract(null);
      } else {
        try {
          await buildConnection();
        } catch(e) {
          console.error("account switch error", e);
        }
      }
    };

    const onChainChanged = () => window.location.reload();

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged",    onChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener("chainChanged",    onChainChanged);
    };
  }, [buildConnection]);

  return (
    <Web3Context.Provider value={{
      provider, signer, contract, account, user,
      chainId, loading, connected,
      connect, refreshUser, CONTRACT_ADDRESS,
      switchToHardhat,
    }}>
      {children}
    </Web3Context.Provider>
  );
}
