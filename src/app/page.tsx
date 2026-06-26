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
import { getVaultContract, DEFAULT_CONTRACT_ADDRESS } from "../utils/contract";
import { uploadToIPFS, downloadFromIPFS } from "../utils/ipfs";
import { BrowserProvider, ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";

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
const INITIAL_VAULTS: Vault[] = [];

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
  
  // Smart Contract Configuration State
  const [contractAddress, setContractAddress] = useState<string>(DEFAULT_CONTRACT_ADDRESS);

  // Sandbox vs Web3 Modes State
  const [isSandboxMode, setIsSandboxMode] = useState<boolean>(false);

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
        const parsed: Vault[] = JSON.parse(savedVaults);
        // Clear/filter out any old mock seed vaults from prior sessions
        const filtered = parsed.filter(v => 
          v.id !== "0x8a92f012b3c7..." && 
          v.id !== "0xfb78a9c2d1b8..."
        );
        setVaults(filtered);
        localStorage.setItem("lastwish_vaults", JSON.stringify(filtered));
      } catch (e) {
        setVaults(INITIAL_VAULTS);
      }
    } else {
      setVaults(INITIAL_VAULTS);
    }

    const savedAddress = localStorage.getItem("lastwish_contract_address");
    if (savedAddress) {
      setContractAddress(savedAddress);
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

  // Sync vault states with contract on-chain
  const syncVaultsWithBlockchain = async () => {
    if (!isConnected || userAddress.startsWith("0x6ab162")) return;
    try {
      const contract = await getVaultContract(contractAddress);
      const savedVaults = localStorage.getItem("lastwish_vaults");
      if (!savedVaults) return;
      const currentVaults: Vault[] = JSON.parse(savedVaults);

      let changed = false;
      const synced = await Promise.all(currentVaults.map(async (v) => {
        if (!v.id.startsWith("0x") || v.id.length !== 66) {
          return v;
        }
        try {
          const details = await contract.getVaultDetails(v.id);
          const statusMap: ("ACTIVE" | "PENDING_UNLOCK" | "UNLOCKED")[] = ["ACTIVE", "PENDING_UNLOCK", "UNLOCKED"];
          const newHeartbeat = Number(details.lastHeartbeat) * 1000;
          const newStatus = statusMap[Number(details.status)] || v.status;
          
          if (v.lastHeartbeat !== newHeartbeat || v.status !== newStatus) {
            changed = true;
          }
          return {
            ...v,
            lastHeartbeat: newHeartbeat,
            status: newStatus
          };
        } catch (e) {
          return v;
        }
      }));

      if (changed) {
        setVaults(synced);
        localStorage.setItem("lastwish_vaults", JSON.stringify(synced));
      }
    } catch (err) {
      console.warn("Periodic sync failed:", err);
    }
  };

  // Run periodic sync every 10 seconds
  useEffect(() => {
    if (isConnected && !userAddress.startsWith("0x6ab162")) {
      const interval = setInterval(() => {
        syncVaultsWithBlockchain();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isConnected, userAddress, contractAddress]);

  // Connect Wallet
  const connectWallet = async (overrideAddress?: string) => {
    if (overrideAddress) {
      setIsConnected(true);
      setUserAddress(overrideAddress);
      setShowLanding(false);
      setIsSandboxMode(false);
      return;
    }

    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const provider = new BrowserProvider((window as any).ethereum);
        const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
        const address = accounts[0];
        setIsConnected(true);
        setUserAddress(address);
        setShowLanding(false);
        setIsSandboxMode(false);
        canvasConfetti({
          particleCount: 50,
          spread: 60,
          colors: ["#e5c483", "#faf6ee", "#ddb892"],
          origin: { y: 0.8 }
        });
        
        // Immediate sync
        setTimeout(() => syncVaultsWithBlockchain(), 500);
      } catch (err: any) {
        console.error("Connection failed:", err);
        fallbackToSim();
      }
    } else {
      fallbackToSim();
    }
  };

  const fallbackToSim = () => {
    const mockAddress = "0x6ab162056d73bc7fc901af572a188f572c188f356";
    setIsConnected(true);
    setUserAddress(mockAddress);
    setShowLanding(false);
    setIsSandboxMode(true);
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setUserAddress("");
    setIsWizardActive(false);
    setShowLanding(true);
    setIsSandboxMode(false);
  };

  // Perform heartbeat check-in
  const triggerHeartbeat = async (vaultId: string) => {
    let success = false;
    
    if (isConnected && !userAddress.startsWith("0x6ab162") && vaultId.startsWith("0x") && vaultId.length === 66) {
      try {
        const contract = await getVaultContract(contractAddress);
        const tx = await contract.heartbeat(vaultId);
        await tx.wait();
        success = true;
      } catch (err: any) {
        console.error("On-chain heartbeat failed:", err);
        alert("Smart contract heartbeat call failed: " + (err.reason || err.message));
        return;
      }
    } else {
      success = true; // sandbox simulation
    }

    if (success) {
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
    }
  };

  // Trigger Veto
  const triggerVeto = async (vaultId: string) => {
    let success = false;
    
    if (isConnected && !userAddress.startsWith("0x6ab162") && vaultId.startsWith("0x") && vaultId.length === 66) {
      try {
        const contract = await getVaultContract(contractAddress);
        const tx = await contract.veto(vaultId);
        await tx.wait();
        success = true;
      } catch (err: any) {
        console.error("On-chain veto failed:", err);
        alert("Smart contract veto call failed: " + (err.reason || err.message));
        return;
      }
    } else {
      success = true; // sandbox simulation
    }

    if (success) {
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
        particleCount: 40,
        spread: 50,
        colors: ["#e5c483", "#faf6ee"]
      });
    }
  };

  // Create Vault Wizard Handlers
  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVaultName || !newRecipient || !newContent) return;

    setIsEncrypting(true);

    try {
      // Step 1: Encrypt locally and split keys
      const result = await encryptAndSplit(newContent, 2, 3);
      
      // Step 2: Upload encrypted payload to IPFS (via Pinata or fallback local simulation)
      const ipfsHash = await uploadToIPFS(result.payload, newVaultName);
      const ipfsUri = `ipfs://${ipfsHash}`;

      // Step 3: Generate a unique bytes32 ID
      const randomBytes = ethers.randomBytes(32);
      const vaultIdBytes32 = ethers.hexlify(randomBytes);

      let onChainRegistered = false;
      
      // Step 4: Try to register on-chain if connected to MetaMask
      if (isConnected && !userAddress.startsWith("0x6ab162")) {
        try {
          const contract = await getVaultContract(contractAddress);
          const tx = await contract.createVault(
            vaultIdBytes32,
            newRecipient,
            newInactivity,
            newGrace,
            result.shares[0], // Share 1 is locked in contract
            ipfsUri
          );
          await tx.wait();
          onChainRegistered = true;
        } catch (contractErr: any) {
          console.error("On-chain registration failed, falling back to local simulation:", contractErr);
          alert("Smart contract transaction failed/rejected. Storing vault locally in simulation mode.\nError: " + (contractErr.reason || contractErr.message));
        }
      }

      // If not registered on-chain, we use a shortened ID for simulation readability
      const finalId = onChainRegistered ? vaultIdBytes32 : "0x" + Array.from({ length: 12 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join("") + "...";

      const createdVault: Vault = {
        id: finalId,
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
      setCreatedVaultId(finalId);
      setStep(4);
    } catch (err: any) {
      alert("Error: " + err.message);
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

    // Let's check if the vault is on-chain and retrieve Share 1 from the contract!
    let share1ToUse = targetVault.share1;
    let payloadToUse = targetVault.payload;
    
    setIsDecrypting(true);
    await new Promise(resolve => setTimeout(resolve, 1200));

    try {
      if (isConnected && !userAddress.startsWith("0x6ab162") && targetVault.id.startsWith("0x") && targetVault.id.length === 66) {
        try {
          const contract = await getVaultContract(contractAddress);
          
          // 1. Fetch on-chain Share 1
          const onChainShare1 = await contract.claimVaultShare(targetVault.id);
          share1ToUse = onChainShare1;

          // 2. Fetch on-chain details to get IPFS CID
          const details = await contract.getVaultDetails(targetVault.id);
          const ipfsUri = details.ipfsHash; // e.g. "ipfs://Qm..."

          // 3. Download encrypted payload from IPFS
          payloadToUse = await downloadFromIPFS(ipfsUri);
        } catch (contractErr: any) {
          console.error("On-chain claimVaultShare / IPFS download failed:", contractErr);
          throw new Error("Failed to retrieve locked data from the smart contract or IPFS. " + (contractErr.reason || contractErr.message));
        }
      } else {
        // If in simulation, let's verify if the status is unlocked
        if (targetVault.status !== "UNLOCKED") {
          throw new Error(`Vault is currently locked. Status: ${targetVault.status}. The inactivity period must fully expire.`);
        }
      }

      if (!recipientShareInput.trim()) {
        throw new Error("Please input your Key Share (Share 2).");
      }

      const sharesToUse = [share1ToUse, recipientShareInput.trim()];
      const decrypted = await reconstructAndDecrypt(payloadToUse, sharesToUse);
      setDecryptionResult(decrypted);
      
      canvasConfetti({
        particleCount: 100,
        spread: 80,
        colors: ["#faf6ee", "#e5c483", "#ddb892"]
      });
    } catch (err: any) {
      setDecryptionError(err.message || "Decryption failed. The Key Share is incorrect or corrupted.");
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
          <div className="flex bg-gray-950/80 border border-gray-900 rounded-full p-1 max-w-sm w-full mx-auto justify-between text-[10px] sm:text-xs">
            <button 
              onClick={() => { setActiveTab("owner"); setIsWizardActive(false); }}
              className={`flex-1 py-1.5 px-2 text-center font-semibold rounded-full transition-all cursor-pointer ${
                activeTab === "owner" ? "bg-gray-900 text-[#faf6ee] border border-[rgba(229,196,131,0.08)]" : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="hidden sm:inline">Owner Dashboard</span>
              <span className="sm:hidden">Owner</span>
            </button>
            <button 
              onClick={() => { setActiveTab("recipient"); setIsWizardActive(false); }}
              className={`flex-1 py-1.5 px-2 text-center font-semibold rounded-full transition-all cursor-pointer ${
                activeTab === "recipient" ? "bg-gray-900 text-[#faf6ee] border border-[rgba(229,196,131,0.08)]" : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="hidden sm:inline">Claim Legacy Portal</span>
              <span className="sm:hidden">Claim</span>
            </button>
            <button 
              onClick={() => { setActiveTab("playground"); setIsWizardActive(false); }}
              className={`flex-1 py-1.5 px-2 text-center font-semibold rounded-full transition-all cursor-pointer ${
                activeTab === "playground" ? "bg-gray-900 text-[#faf6ee] border border-[rgba(229,196,131,0.08)]" : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="hidden sm:inline">ZK/SSS Playground</span>
              <span className="sm:hidden">Sandbox</span>
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

      {/* Sandbox Warning Banner */}
      {isConnected && isSandboxMode && (
        <div className="w-full bg-[#e5c483]/10 border-b border-[#e5c483]/20 py-2.5 px-4 text-center text-xs text-[#e5c483] font-mono flex items-center justify-center space-x-2 z-20">
          <AlertTriangle className="w-4 h-4 text-[#e5c483] animate-pulse" />
          <span>MetaMask not detected. Running in Sandbox Simulation mode.</span>
        </div>
      )}

      {/* Main DApp Container */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 md:p-8 z-10 max-w-7xl w-full mx-auto relative">
        <AnimatePresence mode="wait">
          
          {/* VIEW 1: LANDING SCREEN */}
          {showLanding && (
            <motion.div
              key="landing-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex flex-col items-center justify-between min-h-[70vh] py-12 text-center relative"
            >
              <div className="max-w-3xl space-y-6 my-auto">
                {/* Floating Vault Animation Container */}
                <div className="flex justify-center mb-4 relative">
                  {/* Glowing background aura */}
                  <div className="absolute w-24 h-24 rounded-full bg-[#e5c483]/10 blur-xl animate-pulse" />
                  
                  {/* Floating Vault Emblem */}
                  <div className="relative p-6 bg-gray-950/65 border border-[rgba(229,196,131,0.15)] rounded-2xl animate-float-slow shadow-2xl shadow-[#e5c483]/2 flex items-center justify-center group cursor-pointer hover:border-[#e5c483]/40 transition-all duration-500">
                    {/* Ring border effect */}
                    <div className="absolute inset-0 rounded-2xl border border-dashed border-[#e5c483]/20 animate-[spin_40s_linear_infinite] group-hover:border-[#e5c483]/40" />
                    
                    {/* Vault Icons */}
                    <div className="relative w-10 h-10">
                      <Lock className="w-10 h-10 text-[#e5c483] absolute inset-0 group-hover:scale-90 group-hover:opacity-0 transition-all duration-300" />
                      <Unlock className="w-10 h-10 text-[#faf6ee] absolute inset-0 scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300" />
                    </div>
                  </div>
                </div>

                <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none text-[#faf6ee] animate-float-text">
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

              {/* Glowing Scrollable Perspective Grid Line Canvas */}
              <div className="perspective-container">
                <div className="perspective-grid"></div>
              </div>
            </motion.div>
          )}

          {/* VIEW 2: CONNECT WALLET CARD */}
          {!showLanding && !isConnected && (
            <motion.div
              key="connect-wallet-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel p-8 md:p-12 rounded-3xl max-w-lg w-full text-center space-y-8 my-auto"
            >
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
                  onClick={() => { connectWallet("0x3b1c28f9d0c2b2a9e8f572a188f572c188f356"); setActiveTab("recipient"); }}
                  className="w-full bg-[#faf6ee] hover:bg-[#eae6de] text-[#0d0f19] font-bold py-3.5 rounded-full text-xs transition-all uppercase cursor-pointer"
                >
                  Enter as Recipient
                </button>
              </div>
            </motion.div>
          )}

          {/* VIEW 3: CONNECTED SPACES */}
          {!showLanding && isConnected && (
            <motion.div
              key="connected-spaces-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-xl mx-auto my-auto py-6"
            >
              <AnimatePresence mode="wait">
                
                {/* Owner Tab Dashboard View */}
                {activeTab === "owner" && (
                  <motion.div
                    key="owner-tab-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <AnimatePresence mode="wait">
                      
                      {/* Dashboard Main view */}
                      {!isWizardActive && (
                        <motion.div
                          key="dashboard-main"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          className="space-y-6"
                        >
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
                              {!userAddress.startsWith("0x6ab162") && (
                                <div className="flex flex-col space-y-1 py-2 border-t border-gray-900/40">
                                  <span className="text-gray-400">Contract Address:</span>
                                  <input 
                                    type="text"
                                    value={contractAddress}
                                    onChange={(e) => {
                                      setContractAddress(e.target.value);
                                      localStorage.setItem("lastwish_contract_address", e.target.value);
                                    }}
                                    className="bg-gray-950 border border-gray-900/80 rounded px-2.5 py-1.5 text-[10px] text-gray-300 font-mono focus:outline-none focus:border-[#e5c483]/30 w-full"
                                  />
                                </div>
                              )}
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
                        </motion.div>
                      )}

                      {/* Wizard Step 1: Form Details */}
                      {isWizardActive && step === 1 && (
                        <motion.div
                          key="wizard-step-1"
                          initial={{ opacity: 0, x: 15 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -15 }}
                          className="glass-panel p-6 md:p-8 rounded-3xl space-y-6"
                        >
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
                        </motion.div>
                      )}

                      {/* Wizard Step 2: Time Settings */}
                      {isWizardActive && step === 2 && (
                        <motion.div
                          key="wizard-step-2"
                          initial={{ opacity: 0, x: 15 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -15 }}
                          className="glass-panel p-6 md:p-8 rounded-3xl space-y-6"
                        >
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
                        </motion.div>
                      )}

                      {/* Wizard Step 3: Secret Content Editor */}
                      {isWizardActive && step === 3 && (
                        <motion.div
                          key="wizard-step-3"
                          initial={{ opacity: 0, x: 15 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -15 }}
                          className="glass-panel p-6 md:p-8 rounded-3xl space-y-6"
                        >
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
                        </motion.div>
                      )}

                      {/* Wizard Step 4: Vault Receipt */}
                      {isWizardActive && step === 4 && (
                        <motion.div
                          key="wizard-step-4"
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          className="glass-panel p-6 md:p-8 rounded-3xl space-y-6"
                        >
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
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Recipient Claim Tab View */}
                {activeTab === "recipient" && (
                  <motion.div
                    key="recipient-tab-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="glass-panel p-6 md:p-8 rounded-3xl space-y-6"
                  >
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
                  </motion.div>
                )}

                {/* Cryptographic Playground Sandbox View */}
                {activeTab === "playground" && (
                  <motion.div
                    key="playground-tab-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    
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

                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
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
