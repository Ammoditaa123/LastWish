"use client";

import React, { useState, useEffect } from "react";
import { 
  Shield, 
  ShieldAlert, 
  Key, 
  Lock, 
  Unlock, 
  Hourglass, 
  RefreshCw, 
  Plus, 
  Upload, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  FileText, 
  Trash2, 
  Sparkles,
  Mail,
  Copy,
  Check
} from "lucide-react";
import canvasConfetti from "canvas-confetti";
import { encryptAndSplit, reconstructAndDecrypt, EncryptedPayload } from "../utils/crypto";

// Define Types
interface Vault {
  id: string;
  name: string;
  recipientAddress: string;
  inactivityPeriod: number; // in seconds for demo
  gracePeriod: number;      // in seconds for demo
  createdAt: number;        // timestamp ms
  lastHeartbeat: number;    // timestamp ms
  payload: EncryptedPayload;
  share1: string;           // contract share (index-hex)
  share2: string;           // recipient share
  share3: string;           // backup/keeper share
  status: "ACTIVE" | "PENDING_UNLOCK" | "UNLOCKED";
}

// Initial Mock Seed Data
const INITIAL_VAULTS: Vault[] = [
  {
    id: "0x8a92f012b3c7...",
    name: "Legacy Wallet Backup & Credentials",
    recipientAddress: "0x3b1c28f9d0c2b2a9e8f572a188f572c188f572c1",
    inactivityPeriod: 90,
    gracePeriod: 10,
    createdAt: Date.now() - 40000,
    lastHeartbeat: Date.now() - 40000,
    payload: {
      iv: "YmFzZTY0X2l2X2RlbW8=",
      data: "YmFzZTY0X2NpcGhlcnRleHRfZGVtb19kYXRhX2hlcmU="
    },
    share1: "1-ab73cd28fa90be72",
    share2: "2-ef84ab29fe02de11",
    share3: "3-83dd72ef9a02bc88",
    status: "ACTIVE"
  },
  {
    id: "0xfb78a9c2d1b8...",
    name: "A Letter to My Family",
    recipientAddress: "0xfa2d8811b3c7f901a8ef572a188f572c188f572c",
    inactivityPeriod: 180,
    gracePeriod: 20,
    createdAt: Date.now() - 100000,
    lastHeartbeat: Date.now() - 100000,
    payload: {
      iv: "YmFzZTY0X2l2X2RlbW8y",
      data: "YmFzZTY0X2NpcGhlcnRleHRfZGVtb19kYXRhX2hlcmUy"
    },
    share1: "1-1122334455667788",
    share2: "2-9988776655443322",
    share3: "3-aabbccddeeff0011",
    status: "ACTIVE"
  }
];

// Twinkling Star/Particle Component
interface StarProps {
  top: string;
  left: string;
  size: number;
  delay: string;
}
const Star: React.FC<StarProps> = ({ top, left, size, delay }) => (
  <div 
    className="absolute rounded-full bg-[#faf6ee] animate-twinkle pointer-events-none"
    style={{
      top,
      left,
      width: `${size}px`,
      height: `${size}px`,
      animationDelay: delay,
    }}
  />
);

export default function LastWishApp() {
  // App navigation state (Landing leads to Dash/Claim)
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"owner" | "recipient" | "playground">("owner");
  
  // Wallet Connection Simulation
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [userAddress, setUserAddress] = useState<string>("");
  const [copiedShare, setCopiedShare] = useState<number | null>(null);

  // Background stars
  const [stars, setStars] = useState<Array<{ top: string; left: string; size: number; delay: string }>>([]);

  // Generate stars on mount
  useEffect(() => {
    const starArray = Array.from({ length: 35 }, (_, i) => ({
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: Math.random() * 2 + 1,
      delay: `${Math.random() * 5}s`
    }));
    setStars(starArray);
  }, []);

  // Vault Management States
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);

  // Create Vault Wizard State
  const [step, setStep] = useState<number>(1);
  const [isWizardActive, setIsWizardActive] = useState<boolean>(false);
  const [newVaultName, setNewVaultName] = useState<string>("");
  const [newRecipient, setNewRecipient] = useState<string>("");
  const [newInactivity, setNewInactivity] = useState<number>(30);
  const [newGrace, setNewGrace] = useState<number>(7);
  const [newContent, setNewContent] = useState<string>("");
  const [isEncrypting, setIsEncrypting] = useState<boolean>(false);
  const [createdVaultShares, setCreatedVaultShares] = useState<string[]>([]);
  const [createdVaultPayload, setCreatedVaultPayload] = useState<EncryptedPayload | null>(null);
  const [createdVaultId, setCreatedVaultId] = useState<string>("");

  // Recipient Claim Portal State
  const [claimVaultAddress, setClaimVaultAddress] = useState<string>("");
  const [recipientShareInput, setRecipientShareInput] = useState<string>("");
  const [decryptionResult, setDecryptionResult] = useState<string | null>(null);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);

  // Cryptographic Playground State
  const [pgText, setPgText] = useState<string>("Confluence 2.0 Hackathon Winner");
  const [pgShares, setPgShares] = useState<string[]>([]);
  const [pgSelectedShares, setPgSelectedShares] = useState<string[]>(["", ""]);
  const [pgDecryptedText, setPgDecryptedText] = useState<string>("");
  const [pgDecryptedError, setPgDecryptedError] = useState<string>("");
  const [pgPayload, setPgPayload] = useState<EncryptedPayload | null>(null);

  // Load vaults from localStorage
  useEffect(() => {
    const savedVaults = localStorage.getItem("lastwish_vaults");
    if (savedVaults) {
      try {
        setVaults(JSON.parse(savedVaults));
      } catch (e) {
        setVaults(INITIAL_VAULTS);
      }
    } else {
      setVaults(INITIAL_VAULTS);
    }
  }, []);

  // Update Vault Timers (Lazy Validation check)
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
      
      setVaults(prevVaults => {
        let changed = false;
        const updatedVaults = prevVaults.map(vault => {
          const elapsed = (Date.now() - vault.lastHeartbeat) / 1000;
          const inactivityLimit = vault.inactivityPeriod;
          const graceLimit = vault.gracePeriod;
          
          let newStatus = vault.status;
          
          if (elapsed >= inactivityLimit + graceLimit) {
            newStatus = "UNLOCKED";
          } else if (elapsed >= inactivityLimit) {
            newStatus = "PENDING_UNLOCK";
          } else {
            newStatus = "ACTIVE";
          }
          
          if (newStatus !== vault.status) {
            changed = true;
            return { ...vault, status: newStatus };
          }
          return vault;
        });
        
        if (changed) {
          localStorage.setItem("lastwish_vaults", JSON.stringify(updatedVaults));
        }
        return updatedVaults;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Connect Wallet Simulation
  const connectWallet = (address = "6ab162056d73bc7fc901af572a188f572c188f356") => {
    setIsConnected(true);
    setUserAddress(address);
    setShowLanding(false);
    canvasConfetti({
      particleCount: 50,
      spread: 60,
      colors: ["#e5c483", "#faf6ee", "#ddb892"],
      origin: { y: 0.8 }
    });
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setUserAddress("");
    setIsWizardActive(false);
    setShowLanding(true);
  };

  // Perform heartbeat check-in
  const triggerHeartbeat = (vaultId: string) => {
    setVaults(prev => {
      const updated = prev.map(v => {
        if (v.id === vaultId) {
          return {
            ...v,
            lastHeartbeat: Date.now(),
            status: "ACTIVE" as const
          };
        }
        return v;
      });
      localStorage.setItem("lastwish_vaults", JSON.stringify(updated));
      return updated;
    });

    canvasConfetti({
      particleCount: 20,
      spread: 40,
      colors: ["#e5c483", "#faf6ee"]
    });
  };

  // Trigger Veto
  const triggerVeto = (vaultId: string) => {
    triggerHeartbeat(vaultId);
  };

  // Create Vault Wizard Handlers
  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVaultName || !newRecipient || !newContent) return;

    setIsEncrypting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const result = await encryptAndSplit(newContent, 2, 3);
      
      const newId = "0x" + Array.from({ length: 12 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join("") + "...";

      const createdVault: Vault = {
        id: newId,
        name: newVaultName,
        recipientAddress: newRecipient,
        inactivityPeriod: newInactivity,
        gracePeriod: newGrace,
        createdAt: Date.now(),
        lastHeartbeat: Date.now(),
        payload: result.payload,
        share1: result.shares[0],
        share2: result.shares[1],
        share3: result.shares[2],
        status: "ACTIVE"
      };

      const updatedVaults = [...vaults, createdVault];
      setVaults(updatedVaults);
      localStorage.setItem("lastwish_vaults", JSON.stringify(updatedVaults));

      setCreatedVaultPayload(result.payload);
      setCreatedVaultShares(result.shares);
      setCreatedVaultId(newId);
      setStep(4);
    } catch (err) {
      alert("Error: " + err);
    } finally {
      setIsEncrypting(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedShare(index);
    setTimeout(() => setCopiedShare(null), 2000);
  };

  const resetWizard = () => {
    setStep(1);
    setNewVaultName("");
    setNewRecipient("");
    setNewInactivity(30);
    setNewGrace(7);
    setNewContent("");
    setCreatedVaultShares([]);
    setCreatedVaultPayload(null);
    setCreatedVaultId("");
    setIsWizardActive(false);
  };

  // Recipient Claim Portal Handler
  const handleDecryptVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setDecryptionError(null);
    setDecryptionResult(null);

    const targetVault = vaults.find(v => v.id.toLowerCase().includes(claimVaultAddress.toLowerCase()) || claimVaultAddress.toLowerCase().includes(v.id.toLowerCase()));

    if (!targetVault) {
      setDecryptionError("Vault not found. Please check the Vault ID.");
      return;
    }

    if (targetVault.status !== "UNLOCKED") {
      setDecryptionError(`Vault is currently locked. Status: ${targetVault.status}. The inactivity period must fully expire.`);
      return;
    }

    if (!recipientShareInput.trim()) {
      setDecryptionError("Please input your Key Share.");
      return;
    }

    setIsDecrypting(true);
    await new Promise(resolve => setTimeout(resolve, 1200));

    try {
      const sharesToUse = [targetVault.share1, recipientShareInput.trim()];
      const decrypted = await reconstructAndDecrypt(targetVault.payload, sharesToUse);
      setDecryptionResult(decrypted);
      
      canvasConfetti({
        particleCount: 100,
        spread: 80,
        colors: ["#faf6ee", "#e5c483", "#ddb892"]
      });
    } catch (err: any) {
      setDecryptionError("Decryption failed. The Key Share is incorrect or corrupted.");
    } finally {
      setIsDecrypting(false);
    }
  };

  // Playground Handlers
  const triggerPlaygroundSplit = async () => {
    if (!pgText) return;
    try {
      const result = await encryptAndSplit(pgText, 2, 3);
      setPgShares(result.shares);
      setPgPayload(result.payload);
      setPgSelectedShares([result.shares[0], result.shares[1]]);
      setPgDecryptedText("");
      setPgDecryptedError("");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const triggerPlaygroundDecrypt = async () => {
    setPgDecryptedText("");
    setPgDecryptedError("");

    if (!pgPayload) {
      setPgDecryptedError("Split a secret message first.");
      return;
    }

    const share1 = pgSelectedShares[0].trim();
    const share2 = pgSelectedShares[1].trim();

    if (!share1 || !share2) {
      setPgDecryptedError("Select or paste 2 shares to reconstruct.");
      return;
    }

    try {
      const decrypted = await reconstructAndDecrypt(pgPayload, [share1, share2]);
      setPgDecryptedText(decrypted);
      canvasConfetti({
        particleCount: 50,
        colors: ["#faf6ee", "#e5c483", "#ddb892"]
      });
    } catch (err: any) {
      setPgDecryptedError("Polynomial interpolation failed. Mismatched or corrupted share bytes.");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen relative">
      
      {/* Background Twinkling Stars */}
      {stars.map((star, idx) => (
        <Star key={`star-${idx}`} {...star} />
      ))}

      {/* Header Navigation (Figma Layout Mockup) */}
      <header className="border-b border-[rgba(229,196,131,0.06)] px-6 py-4 flex items-center justify-between z-20 bg-[#0d0f19]/80 backdrop-blur-md">
        
        {/* Brand Logo */}
        <button 
          onClick={() => { setShowLanding(true); setIsWizardActive(false); }}
          className="flex items-center space-x-2 text-left cursor-pointer"
        >
          <span className="text-[#faf6ee] text-lg font-bold flex items-center space-x-1.5 font-mono">
            <span>🔓</span>
            <span>LastWish</span>
          </span>
        </button>

        {/* Central Tab Navigation Container */}
        {!showLanding && (
          <div className="hidden md:flex bg-gray-950/80 border border-gray-900 rounded-full p-1 max-w-sm w-full mx-auto justify-between">
            <button 
              onClick={() => { setActiveTab("owner"); setIsWizardActive(false); }}
              className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-full transition-all cursor-pointer ${
                activeTab === "owner" ? "bg-gray-900 text-[#faf6ee] border border-[rgba(229,196,131,0.08)]" : "text-gray-400 hover:text-white"
              }`}
            >
              Owner Dashboard
            </button>
            <button 
              onClick={() => { setActiveTab("recipient"); setIsWizardActive(false); }}
              className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-full transition-all cursor-pointer ${
                activeTab === "recipient" ? "bg-gray-900 text-[#faf6ee] border border-[rgba(229,196,131,0.08)]" : "text-gray-400 hover:text-white"
              }`}
            >
              Claim Legacy Portal
            </button>
            <button 
              onClick={() => { setActiveTab("playground"); setIsWizardActive(false); }}
              className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-full transition-all cursor-pointer ${
                activeTab === "playground" ? "bg-gray-900 text-[#faf6ee] border border-[rgba(229,196,131,0.08)]" : "text-gray-400 hover:text-white"
              }`}
            >
              ZK/SSS Playground
            </button>
          </div>
        )}

        {/* Wallet Connection Trigger */}
        <div className="flex items-center space-x-3">
          {isConnected ? (
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs text-[#ddb892] bg-[#151824] px-3 py-1.5 rounded-lg border border-[rgba(229,196,131,0.12)]">
                {userAddress.substring(0, 6)}...{userAddress.substring(34)}
              </span>
              <button 
                onClick={disconnectWallet}
                className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 rounded"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button 
              onClick={() => connectWallet()}
              className="bg-gradient-to-r from-[#e5c483] to-[#c5a880] text-gray-950 font-extrabold text-xs px-5 py-2.5 rounded-full transition-all active:scale-95 cursor-pointer shadow-lg shadow-[#e5c483]/5"
            >
              Connect MetaMask
            </button>
          )}
        </div>
      </header>

      {/* Main DApp Container */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 md:p-8 z-10 max-w-7xl w-full mx-auto relative">
        
        {/* VIEW 1: LANDING SCREEN (Figma Layout 1) */}
        {showLanding && (
          <div className="w-full flex flex-col items-center justify-between min-h-[70vh] py-12 text-center relative">
            <div className="max-w-3xl space-y-6 my-auto">
              <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none text-[#faf6ee]">
                Your Digital Legacy.<br />
                Secured Beyond Time.
              </h1>
              <p className="text-gray-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
                Store memories, important documents, and critical digital information in a private encrypted vault that reaches the right person, at the right time.
              </p>
              
              <div className="pt-4">
                <button 
                  onClick={() => setShowLanding(false)}
                  className="outlined-action px-8 py-3 rounded-full text-xs font-bold uppercase transition-all shadow-md"
                >
                  Start →
                </button>
              </div>
            </div>

            {/* Glowing Scrollable Perspective Grid Line Canvas (Mockup Details) */}
            <div className="perspective-container">
              <div className="perspective-grid"></div>
            </div>
          </div>
        )}

        {/* VIEW 2: CONNECT WALLET CARD (Figma Layout 2) */}
        {!showLanding && !isConnected && (
          <div className="glass-panel p-8 md:p-12 rounded-3xl max-w-lg w-full text-center space-y-8 my-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#e5c483] font-mono uppercase">
              Let Your Words Outlive You
            </h2>
            
            <div className="flex flex-col space-y-3">
              <button 
                onClick={() => connectWallet()}
                className="w-full bg-[#faf6ee] hover:bg-[#eae6de] text-[#0d0f19] font-bold py-3.5 rounded-full text-xs transition-all uppercase cursor-pointer"
              >
                Connect Wallet to Begin →
              </button>
              <button 
                onClick={() => { connectWallet("0x3b1c28f9d0c2b2a9e8f572a188f572c188f572c1"); setActiveTab("recipient"); }}
                className="w-full bg-[#faf6ee] hover:bg-[#eae6de] text-[#0d0f19] font-bold py-3.5 rounded-full text-xs transition-all uppercase cursor-pointer"
              >
                Enter as Recipient
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: CONNECTED SPACES */}
        {!showLanding && isConnected && (
          <div className="w-full max-w-xl mx-auto my-auto py-6">
            
            {/* Owner Tab Dashboard View */}
            {activeTab === "owner" && (
              <div className="space-y-6">
                
                {/* Dashboard Main view (Figma Layout 4) */}
                {!isWizardActive && (
                  <div className="space-y-6">
                    <div className="glass-panel p-6 rounded-3xl space-y-6 relative overflow-hidden">
                      <div className="flex items-center justify-between border-b border-gray-900 pb-4">
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Global Security Shield</span>
                          <h3 className="font-extrabold text-sm text-[#faf6ee] uppercase mt-0.5">Owner Check-In Status</h3>
                        </div>
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold tracking-wider uppercase font-mono">
                          Active and Secured
                        </span>
                      </div>

                      <div className="space-y-3 font-mono text-xs">
                        <div className="flex justify-between items-center py-1">
                          <span className="text-gray-400">Vaults Configured:</span>
                          <span className="text-white font-bold">{vaults.length}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-t border-gray-900/40">
                          <span className="text-gray-400">Primary Wallet:</span>
                          <span className="text-[#ddb892] text-[10px] break-all">{userAddress}</span>
                        </div>
                      </div>
                    </div>

                    {/* Setup Trigger */}
                    <div className="text-center pt-4">
                      <button 
                        onClick={() => { setIsWizardActive(true); setStep(1); }}
                        className="outlined-action w-full py-4 rounded-full text-xs font-bold transition-all"
                      >
                        START SETUP →
                      </button>
                    </div>

                    {/* Vaults list dashboard display */}
                    {vaults.length > 0 && (
                      <div className="space-y-3 pt-6 border-t border-gray-900">
                        <h4 className="text-xs font-bold text-[#faf6ee] font-mono uppercase tracking-wider">Active Local Anchors</h4>
                        {vaults.map(v => {
                          const elapsed = Math.floor((Date.now() - v.lastHeartbeat) / 1000);
                          const countdown = Math.max(0, v.inactivityPeriod - elapsed);
                          const graceCountdown = Math.max(0, (v.inactivityPeriod + v.gracePeriod) - elapsed);

                          return (
                            <div key={v.id} className="p-4 bg-gray-950/40 border border-gray-900/60 rounded-2xl flex items-center justify-between gap-4 font-mono text-xs">
                              <div>
                                <h5 className="font-bold text-white text-xs">{v.name}</h5>
                                <p className="text-[10px] text-gray-500 mt-0.5">ID: {v.id}</p>
                              </div>
                              <div className="text-right flex items-center space-x-3">
                                <div>
                                  {v.status === "ACTIVE" && <span className="text-emerald-400">{countdown}s left</span>}
                                  {v.status === "PENDING_UNLOCK" && <span className="text-amber-500 animate-pulse">GRACE ({graceCountdown}s)</span>}
                                  {v.status === "UNLOCKED" && <span className="text-red-400">Unlocked</span>}
                                </div>
                                {v.status === "ACTIVE" && (
                                  <button
                                    onClick={() => triggerHeartbeat(v.id)}
                                    className="px-3 py-1 bg-gray-900 hover:border-[#e5c483]/30 border border-gray-800 text-[#e5c483] rounded-lg text-[10px]"
                                  >
                                    Sign
                                  </button>
                                )}
                                {v.status === "PENDING_UNLOCK" && (
                                  <button
                                    onClick={() => triggerVeto(v.id)}
                                    className="px-3 py-1 bg-amber-500 text-gray-950 font-bold rounded-lg text-[10px]"
                                  >
                                    Veto
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Wizard Step 1: Form Details (Figma Layout 5) */}
                {isWizardActive && step === 1 && (
                  <div className="glass-panel p-6 md:p-8 rounded-3xl space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-900 pb-3">
                      <h3 className="font-bold text-base text-[#faf6ee] font-mono">Create Legacy Vault</h3>
                      <span className="px-2.5 py-0.5 bg-gray-950 border border-gray-900 rounded-md text-[10px] text-[#ddb892] font-mono">
                        Step 1 out of 4
                      </span>
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Vault Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Secret Legacy Access"
                          value={newVaultName}
                          onChange={(e) => setNewVaultName(e.target.value)}
                          className="w-full design-input px-4 py-3 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Recipient Address</label>
                        <input 
                          type="text" 
                          placeholder="0x..."
                          value={newRecipient}
                          onChange={(e) => setNewRecipient(e.target.value)}
                          className="w-full design-input px-4 py-3 text-xs"
                        />
                      </div>

                      <div className="pt-4 flex justify-between items-center gap-4">
                        <button 
                          onClick={() => setIsWizardActive(false)}
                          className="text-xs text-gray-500 hover:text-white font-mono"
                        >
                          &lt;&lt; CANCEL
                        </button>
                        <button 
                          onClick={() => setStep(2)}
                          disabled={!newVaultName || !newRecipient}
                          className="outlined-action px-6 py-3 rounded-full text-xs font-bold"
                        >
                          CONTINUE SETUP →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Wizard Step 2: Time Settings (Figma Layout 6) */}
                {isWizardActive && step === 2 && (
                  <div className="glass-panel p-6 md:p-8 rounded-3xl space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-900 pb-3">
                      <h3 className="font-bold text-base text-[#faf6ee] font-mono">Create Legacy Vault</h3>
                      <span className="px-2.5 py-0.5 bg-gray-950 border border-gray-900 rounded-md text-[10px] text-[#ddb892] font-mono">
                        Step 2 out of 4
                      </span>
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Inactivity Trigger (Demo Seconds)</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[15, 30, 45].map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setNewInactivity(s)}
                              className={`py-2.5 rounded-xl text-xs font-mono border transition-all cursor-pointer ${newInactivity === s ? "bg-[#e5c483]/10 border-[#e5c483] text-[#e5c483] font-bold" : "border-gray-800 bg-gray-950/20 text-gray-400 hover:text-[#faf6ee]"}`}
                            >
                              {s}s
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Grace Period (Veto Window)</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[5, 15, 45].map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setNewGrace(s)}
                              className={`py-2.5 rounded-xl text-xs font-mono border transition-all cursor-pointer ${newGrace === s ? "bg-[#e5c483]/10 border-[#e5c483] text-[#e5c483] font-bold" : "border-gray-800 bg-gray-950/20 text-gray-400 hover:text-[#faf6ee]"}`}
                            >
                              {s}s
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 flex justify-between items-center gap-4">
                        <button 
                          onClick={() => setStep(1)}
                          className="text-xs text-gray-500 hover:text-white font-mono"
                        >
                          &lt;&lt; BACK
                        </button>
                        <button 
                          onClick={() => setStep(3)}
                          className="outlined-action px-6 py-3 rounded-full text-xs font-bold"
                        >
                          SUBMIT &gt;&gt;
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Wizard Step 3: Secret Content Editor */}
                {isWizardActive && step === 3 && (
                  <div className="glass-panel p-6 md:p-8 rounded-3xl space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-900 pb-3">
                      <h3 className="font-bold text-base text-[#faf6ee] font-mono">Create Legacy Vault</h3>
                      <span className="px-2.5 py-0.5 bg-gray-950 border border-gray-900 rounded-md text-[10px] text-[#ddb892] font-mono">
                        Step 3 out of 4
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Secret Memoir / Vault Content</label>
                        <textarea 
                          placeholder="Enter your seed phrase, private documents, or legacy instructions..."
                          value={newContent}
                          onChange={(e) => setNewContent(e.target.value)}
                          rows={6}
                          className="w-full design-input p-4 text-xs resize-none"
                        />
                      </div>

                      {isEncrypting ? (
                        <div className="p-3 bg-gray-950/60 border border-gray-900 rounded-xl space-y-2 text-xs font-mono text-[#e5c483]">
                          <p className="flex items-center space-x-2">
                            <RefreshCw className="w-3 animate-spin" />
                            <span>Running AES-256 local key splits...</span>
                          </p>
                          <p className="text-gray-500">Uploading ciphertext to IPFS...</p>
                        </div>
                      ) : (
                        <div className="pt-4 flex justify-between items-center gap-4">
                          <button 
                            onClick={() => setStep(2)}
                            className="text-xs text-gray-500 hover:text-white font-mono"
                          >
                            &lt;&lt; BACK
                          </button>
                          <button 
                            onClick={handleCreateVault}
                            disabled={!newContent}
                            className="outlined-action px-6 py-3 rounded-full text-xs font-bold"
                          >
                            ENCRYPT & LOCK &gt;&gt;
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Wizard Step 4: Vault Receipt */}
                {isWizardActive && step === 4 && (
                  <div className="glass-panel p-6 md:p-8 rounded-3xl space-y-6">
                    <div className="text-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                      <h4 className="font-extrabold text-emerald-400 text-sm font-mono uppercase tracking-wider">Vault Locked Successfully</h4>
                      <p className="text-[11px] text-gray-400">
                        Payload is client-side encrypted and hosted on IPFS. The key has been split into 3 shares.
                      </p>
                    </div>

                    <div className="p-3 bg-[#0d0f19] border border-gray-900 rounded-xl space-y-1">
                      <span className="text-[10px] text-gray-500 font-mono uppercase block">Vault Address (ID)</span>
                      <p className="text-[11px] font-mono text-[#faf6ee] break-all">{createdVaultId}</p>
                    </div>

                    <div className="space-y-2 pt-2">
                      <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">Secret Key Shares</h5>
                      
                      {/* Share 1 */}
                      <div className="p-2.5 bg-gray-950/40 border border-gray-900/60 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-[#faf6ee] text-[11px]">Share 1 (On-Chain Lock)</p>
                          <p className="text-[10px] text-gray-500">Locked in smart contract.</p>
                        </div>
                        <span className="text-[#e5c483] font-mono text-[10px]">Contract</span>
                      </div>

                      {/* Share 2 */}
                      <div className="p-2.5 bg-gray-950/40 border border-gray-900/60 rounded-xl flex items-center justify-between text-xs gap-3 min-w-0">
                        <div className="truncate">
                          <p className="font-bold text-[#faf6ee] text-[11px]">Share 2 (Recipient / Heir)</p>
                          <p className="text-[10px] text-gray-500 font-mono truncate">{createdVaultShares[1]}</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(createdVaultShares[1], 1)}
                          className="p-1.5 hover:bg-[#e5c483]/10 text-[#e5c483] rounded-lg flex-shrink-0 cursor-pointer"
                        >
                          {copiedShare === 1 ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Share 3 */}
                      <div className="p-2.5 bg-gray-950/40 border border-gray-900/60 rounded-xl flex items-center justify-between text-xs gap-3 min-w-0">
                        <div className="truncate">
                          <p className="font-bold text-[#faf6ee] text-[11px]">Share 3 (Backup Escrow)</p>
                          <p className="text-[10px] text-gray-500 font-mono truncate">{createdVaultShares[2]}</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(createdVaultShares[2], 2)}
                          className="p-1.5 hover:bg-[#e5c483]/10 text-[#e5c483] rounded-lg flex-shrink-0 cursor-pointer"
                        >
                          {copiedShare === 2 ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <button 
                      onClick={resetWizard}
                      className="w-full border border-gray-800 text-gray-400 hover:text-white font-bold py-3 rounded-full text-xs font-mono cursor-pointer"
                    >
                      CREATE ANOTHER VAULT
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* Recipient Claim Tab View (Figma Layout 3) */}
            {activeTab === "recipient" && (
              <div className="glass-panel p-6 md:p-8 rounded-3xl space-y-6">
                <div className="text-center border-b border-gray-900 pb-4">
                  <h2 className="text-2xl font-extrabold text-[#e5c483] tracking-wider uppercase font-mono">
                    RECLAIM Digital LEGACY VAULT
                  </h2>
                </div>

                <form onSubmit={handleDecryptVault} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Vault ID</label>
                    <input 
                      type="text" 
                      placeholder="0x..."
                      value={claimVaultAddress}
                      onChange={(e) => setClaimVaultAddress(e.target.value)}
                      className="w-full design-input px-4 py-3 text-xs"
                    />
                    <p className="text-[10px] text-gray-600 font-mono">
                      (e.g., {vaults[0]?.id || "0x8a92f012b3c7..."})
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Recipient Key Share (Share 2)</label>
                    <textarea 
                      placeholder="Paste the Share 2 hex string here..."
                      value={recipientShareInput}
                      onChange={(e) => setRecipientShareInput(e.target.value)}
                      rows={2}
                      className="w-full design-input px-4 py-3 text-xs resize-none"
                    />
                  </div>

                  {isDecrypting ? (
                    <div className="p-4 bg-gray-950/60 border border-gray-900 rounded-2xl text-center space-y-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#e5c483] mx-auto" />
                      <p className="text-xs text-gray-400 font-mono">Querying vault smart contract & resolving GF(256) polynomials...</p>
                    </div>
                  ) : (
                    <button 
                      type="submit"
                      className="outlined-action w-full py-4 rounded-full text-xs font-bold cursor-pointer"
                    >
                      DECRYPT & RECONSTRUCT →
                    </button>
                  )}
                </form>

                {decryptionError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start space-x-3 text-red-400 text-xs font-mono">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <h5 className="font-bold">Error Check</h5>
                      <p className="text-[11px] mt-0.5">{decryptionError}</p>
                    </div>
                  </div>
                )}

                {decryptionResult && (
                  <div className="p-5 bg-emerald-500/[0.02] border border-emerald-500/20 rounded-2xl space-y-3 font-mono">
                    <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Decryption Success</span>
                    </div>
                    <div className="p-4 bg-[#0d0f19] border border-gray-900 rounded-xl text-xs text-[#faf6ee] break-all whitespace-pre-wrap">
                      {decryptionResult}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cryptographic Playground Sandbox View */}
            {activeTab === "playground" && (
              <div className="space-y-6">
                
                {/* Split segment */}
                <div className="glass-panel p-6 rounded-3xl space-y-6">
                  <div>
                    <span className="text-[10px] text-[#e5c483] font-mono uppercase tracking-widest">Mathematical Sandbox</span>
                    <h3 className="text-xl font-bold text-white mt-0.5">Key-Splitting Playground</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Split any secret string into 3 shares (threshold 2) locally in your browser.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 uppercase font-mono font-bold tracking-wider">Secret Message</label>
                      <input 
                        type="text" 
                        value={pgText}
                        onChange={(e) => setPgText(e.target.value)}
                        className="w-full design-input px-4 py-2.5 text-sm"
                      />
                    </div>

                    <button 
                      onClick={triggerPlaygroundSplit}
                      className="outlined-action w-full py-3.5 rounded-full text-xs font-bold"
                    >
                      Split Secret into 3 Shares
                    </button>
                  </div>

                  {pgShares.length > 0 && (
                    <div className="space-y-2.5 pt-2">
                      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">Generated Shares</h4>
                      {pgShares.map((s, idx) => (
                        <div key={idx} className="p-2.5 bg-gray-950/40 border border-gray-900 rounded-xl flex items-center justify-between text-xs gap-3">
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-[#e5c483] font-mono">Share {idx + 1}</span>
                            <p className="text-[11px] text-gray-400 font-mono truncate">{s}</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(s, idx)}
                            className="p-1.5 hover:bg-[#e5c483]/10 text-[#e5c483] rounded-lg flex-shrink-0 cursor-pointer"
                          >
                            {copiedShare === idx ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reconstruction segment */}
                <div className="glass-panel p-6 rounded-3xl space-y-6">
                  <div>
                    <span className="text-[10px] text-[#ddb892] font-mono uppercase tracking-widest font-bold">Lagrange Polynomials</span>
                    <h3 className="text-xl font-bold text-white mt-0.5">Reconstruct Secret</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Paste any 2 generated shares. If the polynomial fits, the secret resolves.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-bold uppercase font-mono">Key Share 1</label>
                      <input 
                        type="text" 
                        value={pgSelectedShares[0]}
                        onChange={(e) => setPgSelectedShares([e.target.value, pgSelectedShares[1]])}
                        className="w-full design-input px-4 py-2.5 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-bold uppercase font-mono">Key Share 2</label>
                      <input 
                        type="text" 
                        value={pgSelectedShares[1]}
                        onChange={(e) => setPgSelectedShares([pgSelectedShares[0], e.target.value])}
                        className="w-full design-input px-4 py-2.5 text-xs font-mono"
                      />
                    </div>

                    <button 
                      onClick={triggerPlaygroundDecrypt}
                      className="outlined-action w-full py-3.5 rounded-full text-xs font-bold"
                    >
                      Run Lagrange Interpolation
                    </button>
                  </div>

                  {pgDecryptedText && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1 font-mono">
                      <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Resolved Text</span>
                      <p className="text-sm font-bold text-white leading-tight">{pgDecryptedText}</p>
                    </div>
                  )}

                  {pgDecryptedError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1 font-mono text-red-400 text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider block">Interpolation Error</span>
                      <p>{pgDecryptedError}</p>
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* Footer (Mockup Alignment) */}
      <footer className="border-t border-[rgba(229,196,131,0.06)] py-6 px-6 text-center text-xs text-gray-500 flex flex-col md:flex-row items-center justify-between gap-4 z-20 bg-[#0d0f19]/80 backdrop-blur-sm">
        <div>
          <span>© 2026 LastWish Protocol. Designed for </span>
          <span className="font-bold text-gray-400">Confluence 2.0 Hackathon</span>
          <span>.</span>
        </div>
        <div className="flex items-center space-x-4">
          <a href="#" className="hover:text-white flex items-center space-x-1">
            <Mail className="w-3.5 h-3.5" />
            <span>Support</span>
          </a>
          <a href="#" className="hover:text-white flex items-center space-x-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Technical Whitepaper</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
