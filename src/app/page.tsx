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
  Check,
  Search,
  Eye,
  Image,
  Video,
  Music,
  MessageSquare,
  Download,
  File,
  Wallet,
  Box,
  LayoutDashboard,
  Database,
  PlusCircle,
  Activity,
  Settings
} from "lucide-react";
import canvasConfetti from "canvas-confetti";
import { encryptAndSplit, reconstructAndDecrypt, EncryptedPayload } from "../utils/crypto";
import { getVaultContract, DEFAULT_CONTRACT_ADDRESS } from "../utils/contract";
import { uploadToIPFS, downloadFromIPFS } from "../utils/ipfs";
import { BrowserProvider, ethers } from "ethers";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import FluidGlass from "../components/FluidGlass";
// Define Types for Multi-Recipient Architecture
interface VaultConfig {
  recipientAddress: string;
  category: string;          // Memories, Finances, Medical, Custom
  inactivityPeriod: number;  // in seconds for demo
  gracePeriod: number;       // in seconds for demo
  share1: string;            // locked on-chain share
  share2: string;            // recipient share (given to heir)
  share3: string;            // backup share
  ipfsHash: string;          // IPFS CID of encrypted payload
  fileName?: string;         // Optional file name if uploaded
  fileType?: string;         // Optional file type if uploaded
  status: "ACTIVE" | "PENDING_UNLOCK" | "UNLOCKED";
}

interface Vault {
  id: string;                // Vault ID (bytes32 hex)
  name: string;              // User-facing name
  createdAt: number;         // ms
  lastHeartbeat: number;     // ms
  ownerAddress: string;
  configs: VaultConfig[];
}

interface CategoryConfigInput {
  id: string;
  category: string;
  recipient: string;
  inactivityPeriod: number;
  gracePeriod: number;
  content: string;           // Plain text or File Data URL
  fileName?: string;
  fileType?: string;
}

const heroAssets = [
  { id: "docs", label: "PDF / Documents", icon: FileText },
  { id: "images", label: "Images", icon: Image },
  { id: "videos", label: "Videos", icon: Video },
  { id: "audio", label: "Audio", icon: Music },
  { id: "wallet", label: "Crypto Wallet", icon: Wallet },
  { id: "messages", label: "Letters & Messages", icon: Mail },
];



export default function LastWishApp() {
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"owner" | "recipient" | "inspector" | "playground">("owner");
  const [landingTab, setLandingTab] = useState<"home" | "how-it-works" | "security" | "about">("home");
  const [inspectSubTab, setInspectSubTab] = useState<"overview" | "recipients" | "files" | "transactions" | "contract">("overview");
  
  // Wallet state
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [userAddress, setUserAddress] = useState<string>("");
  const [copiedShare, setCopiedShare] = useState<string | null>(null);

  // Vault Hero Animation State
  const [animationStage, setAnimationStage] = useState<number>(0);

  // Hero 3D Tilt Vault Card State
  const [isCardHovered, setIsCardHovered] = useState(false);
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  
  const tiltXSpring = useSpring(tiltX, { stiffness: 120, damping: 20 });
  const tiltYSpring = useSpring(tiltY, { stiffness: 120, damping: 20 });
  
  const rotateXVal = useTransform(tiltYSpring, [-0.5, 0.5], [8, -8]);
  const rotateYVal = useTransform(tiltXSpring, [-0.5, 0.5], [-8, 8]);

  const lockParallaxX = useTransform(tiltXSpring, [-0.5, 0.5], [-10, 10]);
  const lockParallaxY = useTransform(tiltYSpring, [-0.5, 0.5], [-10, 10]);

  const assetsParallaxX = useTransform(tiltXSpring, [-0.5, 0.5], [-20, 20]);
  const assetsParallaxY = useTransform(tiltYSpring, [-0.5, 0.5], [-20, 20]);

  const bgParallaxX = useTransform(tiltXSpring, [-0.5, 0.5], [12, -12]);
  const bgParallaxY = useTransform(tiltYSpring, [-0.5, 0.5], [12, -12]);

  const handleCardMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - rect.width / 2;
    const mouseY = event.clientY - rect.top - rect.height / 2;
    tiltX.set(mouseX / rect.width);
    tiltY.set(mouseY / rect.height);
  };
  
  const handleCardMouseLeave = () => {
    setIsCardHovered(false);
    tiltX.set(0);
    tiltY.set(0);
  };
  useEffect(() => {
    if (!showLanding) return;
    const interval = setInterval(() => {
      setAnimationStage((prev) => (prev + 1) % 5);
    }, 2800);
    return () => clearInterval(interval);
  }, [showLanding]);

  const [ctaHovered, setCtaHovered] = useState<boolean>(false);
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  // Custom Settings inputs
  const [settingsPinataJwt, setSettingsPinataJwt] = useState<string>("");
  const [settingsCustomGateway, setSettingsCustomGateway] = useState<string>("");

  useEffect(() => {
    if (showSettingsModal && typeof window !== "undefined") {
      setSettingsPinataJwt(localStorage.getItem("lastwish_pinata_jwt") || "");
      setSettingsCustomGateway(localStorage.getItem("lastwish_custom_ipfs_gateway") || "");
    }
  }, [showSettingsModal]);

  // Background stars
  const [stars, setStars] = useState<Array<{ top: string; left: string; size: number; delay: string }>>([]);
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
  const [contractAddress, setContractAddress] = useState<string>(DEFAULT_CONTRACT_ADDRESS);
  const [isSandboxMode, setIsSandboxMode] = useState<boolean>(false);

  // Setup Wizard State
  const [step, setStep] = useState<number>(1);
  const [isWizardActive, setIsWizardActive] = useState<boolean>(false);
  const [newVaultName, setNewVaultName] = useState<string>("");
  
  // Current editing category state
  const [wizardCategories, setWizardCategories] = useState<CategoryConfigInput[]>([]);
  const [editCategory, setEditCategory] = useState<string>("Memories");
  const [editRecipient, setEditRecipient] = useState<string>("");
  const [editInactivity, setEditInactivity] = useState<number>(30);
  const [editGrace, setEditGrace] = useState<number>(7);
  const [editContent, setEditContent] = useState<string>("");
  const [editContentType, setEditContentType] = useState<"text" | "file">("text");
  
  // File state
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [uploadedFileType, setUploadedFileType] = useState<string>("");
  const [isEncrypting, setIsEncrypting] = useState<boolean>(false);

  // Wizard results
  const [createdVaultId, setCreatedVaultId] = useState<string>("");
  const [createdVaultConfigs, setCreatedVaultConfigs] = useState<VaultConfig[]>([]);

  // Recipient Claim Portal State
  const [claimVaultAddress, setClaimVaultAddress] = useState<string>("");
  const [claimCategory, setClaimCategory] = useState<string>("Memories");
  const [recipientShareInput, setRecipientShareInput] = useState<string>("");
  const [manualPayloadInput, setManualPayloadInput] = useState<string>("");
  const [decryptionResult, setDecryptionResult] = useState<string | null>(null);
  const [decryptedItems, setDecryptedItems] = useState<Array<{ category: string; fileName?: string; fileType?: string; content: string }>>([]);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [decryptedFileName, setDecryptedFileName] = useState<string | null>(null);
  const [decryptedFileType, setDecryptedFileType] = useState<string | null>(null);

  // On-Chain Vault Inspector State
  const [inspectVaultId, setInspectVaultId] = useState<string>("");
  const [inspectedVault, setInspectedVault] = useState<any | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [isInspectLoading, setIsInspectLoading] = useState<boolean>(false);

  // Playground Sandbox State
  const [pgText, setPgText] = useState<string>("Confluence 2.0 Hackathon Winner");
  const [pgShares, setPgShares] = useState<string[]>([]);
  const [pgSelectedShares, setPgSelectedShares] = useState<string[]>(["", ""]);
  const [pgDecryptedText, setPgDecryptedText] = useState<string>("");
  const [pgDecryptedError, setPgDecryptedError] = useState<string>("");
  const [pgPayload, setPgPayload] = useState<EncryptedPayload | null>(null);

  // Load vaults from localStorage
  useEffect(() => {
    const savedVaults = localStorage.getItem("lastwish_vaults_v2");
    if (savedVaults) {
      try {
        setVaults(JSON.parse(savedVaults));
      } catch (e) {
        setVaults([]);
      }
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
          
          const updatedConfigs = vault.configs.map(config => {
            let newStatus = config.status;
            if (elapsed >= config.inactivityPeriod + config.gracePeriod) {
              newStatus = "UNLOCKED";
            } else if (elapsed >= config.inactivityPeriod) {
              newStatus = "PENDING_UNLOCK";
            } else {
              newStatus = "ACTIVE";
            }
            if (newStatus !== config.status) {
              changed = true;
              return { ...config, status: newStatus as any };
            }
            return config;
          });

          if (changed) {
            return { ...vault, configs: updatedConfigs };
          }
          return vault;
        });
        
        if (changed) {
          localStorage.setItem("lastwish_vaults_v2", JSON.stringify(updatedVaults));
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
      const savedVaults = localStorage.getItem("lastwish_vaults_v2");
      if (!savedVaults) return;
      const currentVaults: Vault[] = JSON.parse(savedVaults);

      let changed = false;
      const synced = await Promise.all(currentVaults.map(async (v) => {
        if (!v.id.startsWith("0x") || v.id.length !== 66) {
          return v;
        }
        try {
          console.log(`[Sync] Querying blockchain for Vault ID: ${v.id}...`);
          const details = await contract.getVaultDetails(v.id);
          const newHeartbeat = Number(details.lastHeartbeat) * 1000;
          const statusMap: ("ACTIVE" | "PENDING_UNLOCK" | "UNLOCKED")[] = ["ACTIVE", "PENDING_UNLOCK", "UNLOCKED"];

          const updatedConfigs = await Promise.all(v.configs.map(async (cfg) => {
            const onChainStatusNum = await contract.getRecipientStatus(v.id, cfg.recipientAddress, cfg.category);
            const onChainStatus = statusMap[Number(onChainStatusNum)] || cfg.status;
            
            if (cfg.status !== onChainStatus) {
              changed = true;
            }
            return {
              ...cfg,
              status: onChainStatus
            };
          }));

          if (v.lastHeartbeat !== newHeartbeat || changed) {
            changed = true;
            return {
              ...v,
              lastHeartbeat: newHeartbeat,
              configs: updatedConfigs
            };
          }
          return v;
        } catch (e: any) {
          console.log(`[Sync] Failed/Reverted for Vault ID: ${v.id}. Error: ${e.message}`);
          return v;
        }
      }));

      if (changed) {
        setVaults(synced);
        localStorage.setItem("lastwish_vaults_v2", JSON.stringify(synced));
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
          colors: ["#e5c483", "#faf6ee", "#ddb892"]
        });
        
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
            const updatedConfigs = v.configs.map(cfg => ({ ...cfg, status: "ACTIVE" as const }));
            return {
              ...v,
              lastHeartbeat: Date.now(),
              configs: updatedConfigs
            };
          }
          return v;
        });
        localStorage.setItem("lastwish_vaults_v2", JSON.stringify(updated));
        return updated;
      });

      canvasConfetti({
        particleCount: 20,
        spread: 40,
        colors: ["#e5c483", "#faf6ee"]
      });
    }
  };

  const triggerGlobalHeartbeat = async () => {
    const ownerVaults = vaults.filter(v => !isConnected || !userAddress || v.ownerAddress.toLowerCase() === userAddress.toLowerCase());
    if (ownerVaults.length === 0) {
      alert("No vaults found to send a heartbeat.");
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let currentVaults = [...vaults];

    for (const v of ownerVaults) {
      let success = false;
      if (isConnected && !userAddress.startsWith("0x6ab162") && v.id.startsWith("0x") && v.id.length === 66) {
        try {
          const contract = await getVaultContract(contractAddress);
          const tx = await contract.heartbeat(v.id);
          await tx.wait();
          success = true;
        } catch (err: any) {
          console.error(`On-chain heartbeat failed for vault ${v.id}:`, err);
          failCount++;
        }
      } else {
        success = true; // sandbox simulation
      }

      if (success) {
        currentVaults = currentVaults.map(vaultItem => {
          if (vaultItem.id === v.id) {
            const updatedConfigs = vaultItem.configs.map(cfg => ({ ...cfg, status: "ACTIVE" as const }));
            return {
              ...vaultItem,
              lastHeartbeat: Date.now(),
              configs: updatedConfigs
            };
          }
          return vaultItem;
        });
        successCount++;
      }
    }

    setVaults(currentVaults);
    localStorage.setItem("lastwish_vaults_v2", JSON.stringify(currentVaults));

    if (successCount > 0) {
      canvasConfetti({
        particleCount: 80,
        spread: 60,
        colors: ["#faf6ee", "#e5c483", "#2ECC71"]
      });
    }

    if (failCount === 0) {
      alert(`Successfully sent global heartbeat check-in for all ${successCount} vault(s).`);
    } else {
      alert(`Global heartbeat completed: ${successCount} successful, ${failCount} failed.`);
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
            const updatedConfigs = v.configs.map(cfg => ({ ...cfg, status: "ACTIVE" as const }));
            return {
              ...v,
              lastHeartbeat: Date.now(),
              configs: updatedConfigs
            };
          }
          return v;
        });
        localStorage.setItem("lastwish_vaults_v2", JSON.stringify(updated));
        return updated;
      });

      canvasConfetti({
        particleCount: 40,
        spread: 50,
        colors: ["#e5c483", "#faf6ee"]
      });
    }
  };

  // Delete Vault from Local Storage
  const deleteVault = (vaultId: string) => {
    if (confirm("Are you sure you want to remove this vault from your local dashboard? (On-chain data will not be deleted)")) {
      const updated = vaults.filter(v => v.id !== vaultId);
      setVaults(updated);
      localStorage.setItem("lastwish_vaults_v2", JSON.stringify(updated));
    }
  };

  // Query On-Chain Vault Metadata
  const queryOnChainVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setInspectError(null);
    setInspectedVault(null);

    const cleanId = inspectVaultId.trim();
    const localVault = vaults.find(v => v.id.toLowerCase() === cleanId.toLowerCase() || cleanId.toLowerCase().includes(v.id.toLowerCase()));

    if (!localVault && (!cleanId.startsWith("0x") || cleanId.length !== 66)) {
      setInspectError("Please enter a valid 66-character bytes32 Vault ID (starting with 0x) or a simulated Vault ID.");
      return;
    }

    if (localVault && (!cleanId.startsWith("0x") || cleanId.length !== 66)) {
      setInspectedVault({
        id: localVault.id,
        owner: userAddress || "0xC271E35E529ab34ce2224792cF368bAF13eCE163",
        lastHeartbeat: localVault.lastHeartbeat,
        recipientCount: localVault.configs.length,
        configs: localVault.configs.map(c => ({
          recipientAddress: c.recipientAddress,
          category: c.category,
          inactivityPeriod: c.inactivityPeriod,
          gracePeriod: c.gracePeriod,
          share1: c.share1,
          ipfsHash: c.ipfsHash,
          status: c.status
        }))
      });
      canvasConfetti({
        particleCount: 25,
        spread: 40,
        colors: ["#e5c483", "#faf6ee"]
      });
      return;
    }

    setIsInspectLoading(true);
    try {
      const contract = await getVaultContract(contractAddress);
      console.log(`[Inspector] Querying contract details for Vault ID: ${cleanId}...`);
      const details = await contract.getVaultDetails(cleanId);
      const onChainRecipients = await contract.getVaultRecipients(cleanId);
      
      const statusMap = ["ACTIVE", "PENDING_UNLOCK", "UNLOCKED"];
      
      const configs = onChainRecipients.map((r: any) => {
        return {
          recipientAddress: r.recipient,
          category: r.category,
          inactivityPeriod: Number(r.inactivityPeriod),
          gracePeriod: Number(r.gracePeriod),
          share1: r.share1,
          ipfsHash: r.ipfsHash
        };
      });

      // Query dynamic status for each recipient/category config
      const configsWithStatus = await Promise.all(configs.map(async (c: any) => {
        const rawStatus = await contract.getRecipientStatus(cleanId, c.recipientAddress, c.category);
        return {
          ...c,
          status: statusMap[Number(rawStatus)] || "ACTIVE"
        };
      }));
      
      setInspectedVault({
        id: cleanId,
        owner: details.owner,
        lastHeartbeat: Number(details.lastHeartbeat) * 1000,
        recipientCount: Number(details.recipientCount),
        configs: configsWithStatus
      });

      canvasConfetti({
        particleCount: 25,
        spread: 40,
        colors: ["#e5c483", "#faf6ee"]
      });
    } catch (err: any) {
      console.error("Inspector fetch failed:", err);
      setInspectError(err.reason || err.message || "Failed to fetch details. Make sure the Vault ID is correct and you are connected to Base Sepolia.");
    } finally {
      setIsInspectLoading(false);
    }
  };

  // Add category recipient to current editing list in Wizard
  const addCategoryToWizard = () => {
    if (!editRecipient || !editContent) return;
    
    // Simple address validation
    if (!editRecipient.startsWith("0x") || editRecipient.length !== 42) {
      alert("Please enter a valid 42-character recipient address.");
      return;
    }

    const isDuplicate = wizardCategories.some(c => c.recipient.toLowerCase() === editRecipient.toLowerCase() && c.category === editCategory);
    if (isDuplicate) {
      alert("A configuration for this recipient under this category already exists.");
      return;
    }

    const newItem: CategoryConfigInput = {
      id: Math.random().toString(36).substring(7),
      category: editCategory,
      recipient: editRecipient,
      inactivityPeriod: editInactivity,
      gracePeriod: editGrace,
      content: editContent,
      fileName: editContentType === "file" ? uploadedFileName : undefined,
      fileType: editContentType === "file" ? uploadedFileType : undefined
    };

    setWizardCategories([...wizardCategories, newItem]);
    
    // Reset edit state (keep recipient/times for convenience, clear contents)
    setEditContent("");
    setUploadedFileName("");
    setUploadedFileType("");
  };

  const removeCategoryFromWizard = (id: string) => {
    setWizardCategories(wizardCategories.filter(c => c.id !== id));
  };

  // Handle File Upload & Convert to Data URL
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.size > 2 * 1024 * 1024) {
      alert("For local prototype, please limit upload file size to 2MB.");
      return;
    }

    setUploadedFileName(file.name);
    setUploadedFileType(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      setEditContent(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Execute wizard configuration encryption and on-chain registration
  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wizardCategories.length === 0 || !newVaultName) return;

    setIsEncrypting(true);

    try {
      const finalConfigs: VaultConfig[] = [];
      const onChainConfigsParam = [];

      // Step 1: Encrypt each category configuration separately
      for (const catInput of wizardCategories) {
        // Encrypt locally and split keys (2-of-3 SSS)
        const result = await encryptAndSplit(catInput.content, 2, 3);
        
        // Upload ciphertext to IPFS (via Pinata or local simulation fallback)
        const ipfsHash = await uploadToIPFS(result.payload, `${newVaultName}-${catInput.category}`);
        const ipfsUri = `ipfs://${ipfsHash}`;

        finalConfigs.push({
          recipientAddress: catInput.recipient,
          category: catInput.category,
          inactivityPeriod: catInput.inactivityPeriod,
          gracePeriod: catInput.gracePeriod,
          share1: result.shares[0],
          share2: result.shares[1],
          share3: result.shares[2],
          ipfsHash: ipfsUri,
          fileName: catInput.fileName,
          fileType: catInput.fileType,
          status: "ACTIVE"
        });

        // Add config structure matching smart contract ABI input
        onChainConfigsParam.push({
          recipient: catInput.recipient,
          category: catInput.category,
          inactivityPeriod: catInput.inactivityPeriod,
          gracePeriod: catInput.gracePeriod,
          share1: result.shares[0],
          ipfsHash: ipfsUri
        });
      }

      // Step 2: Generate bytes32 vault ID
      const randomBytes = ethers.randomBytes(32);
      const vaultIdBytes32 = ethers.hexlify(randomBytes);

      let onChainRegistered = false;

      // Step 3: Call contract if connected
      if (isConnected && !userAddress.startsWith("0x6ab162")) {
        try {
          const contract = await getVaultContract(contractAddress);
          const tx = await contract.createVault(vaultIdBytes32, onChainConfigsParam);
          await tx.wait();
          onChainRegistered = true;
        } catch (contractErr: any) {
          console.error("On-chain registration failed, falling back to local simulation:", contractErr);
          alert("Smart contract transaction failed/rejected. Storing vault locally in simulation mode.\nError: " + (contractErr.reason || contractErr.message));
        }
      }

      const finalId = onChainRegistered ? vaultIdBytes32 : "0x" + Array.from({ length: 12 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join("") + "...";

      const createdVault: Vault = {
        id: finalId,
        name: newVaultName,
        createdAt: Date.now(),
        lastHeartbeat: Date.now(),
        ownerAddress: userAddress,
        configs: finalConfigs
      };

      const updatedVaults = [...vaults, createdVault];
      setVaults(updatedVaults);
      localStorage.setItem("lastwish_vaults_v2", JSON.stringify(updatedVaults));

      setCreatedVaultConfigs(finalConfigs);
      setCreatedVaultId(finalId);
      setStep(4);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsEncrypting(false);
    }
  };

  const parseManualPayload = (input: string, category: string): EncryptedPayload => {
    const parsed = JSON.parse(input.trim());
    if (parsed.configs && Array.isArray(parsed.configs)) {
      const match = parsed.configs.find((c: any) => c.category.toLowerCase() === category.toLowerCase());
      if (match && match.rawEncryptedPayload) {
        return match.rawEncryptedPayload;
      } else if (match && match.payload) {
        return match.payload;
      } else {
        throw new Error(`Pasted backup JSON does not contain payload for category '${category}'.`);
      }
    } else if (parsed.iv && parsed.data) {
      return parsed;
    } else {
      throw new Error("Pasted JSON is not a valid payload.");
    }
  };

  // Decrypt recipient categories in portal
  const handleDecryptVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setDecryptionError(null);
    setDecryptionResult(null);
    setDecryptedItems([]);
    setDecryptedFileName(null);
    setDecryptedFileType(null);

    const cleanAddress = claimVaultAddress.trim();
    let isOnChain = false;

    if (cleanAddress.startsWith("0x") && cleanAddress.length === 66 && isConnected && !userAddress.startsWith("0x6ab162")) {
      isOnChain = true;
    }

    const targetVault = vaults.find(v => v.id.toLowerCase().includes(cleanAddress.toLowerCase()) || cleanAddress.toLowerCase().includes(v.id.toLowerCase()));

    // Find the configs matching recipient address
    let configsToProcess: Array<{ category: string; share1: string; fileName?: string; fileType?: string; ipfsHash: string; status?: string }> = [];

    if (isOnChain) {
      try {
        const contract = await getVaultContract(contractAddress);
        const recipients = await contract.getVaultRecipients(cleanAddress);
        
        // Filter by connected userAddress
        const matchingRecipients = recipients.filter(
          (r: any) => r.recipient.toLowerCase() === userAddress.toLowerCase()
        );

        if (matchingRecipients.length === 0) {
          throw new Error(`Connected wallet (${userAddress.slice(0, 6)}...${userAddress.slice(-4)}) is not registered as a recipient in this vault on-chain.`);
        }

        for (const r of matchingRecipients) {
          configsToProcess.push({
            category: r.category,
            share1: "", // will fetch on-chain
            ipfsHash: r.ipfsHash
          });
        }
      } catch (err: any) {
        setDecryptionError(err.message || "Failed to query vault configurations from blockchain.");
        return;
      }
    } else {
      if (!targetVault) {
        setDecryptionError("Vault not found. Please verify the Vault ID.");
        return;
      }
      
      let localMatching = targetVault.configs.filter(
        cfg => cfg.share2.trim() === recipientShareInput.trim()
      );

      if (localMatching.length === 0) {
        localMatching = targetVault.configs.filter(
          cfg => !isConnected || !userAddress || cfg.recipientAddress.toLowerCase() === userAddress.toLowerCase()
        );
      }

      if (localMatching.length === 0) {
        localMatching = targetVault.configs;
      }

      if (localMatching.length === 0) {
        setDecryptionError("No configurations found in this simulated vault.");
        return;
      }

      for (const cfg of localMatching) {
        configsToProcess.push({
          category: cfg.category,
          share1: cfg.share1,
          fileName: cfg.fileName,
          fileType: cfg.fileType,
          ipfsHash: cfg.ipfsHash,
          status: cfg.status
        });
      }
    }

    if (!recipientShareInput.trim()) {
      setDecryptionError("Please input your Key Share (Share 2).");
      return;
    }

    setIsDecrypting(true);
    await new Promise(resolve => setTimeout(resolve, 1200));

    const results: Array<{ category: string; fileName?: string; fileType?: string; content: string }> = [];
    const errors: string[] = [];

    for (const item of configsToProcess) {
      try {
        let share1ToUse = item.share1;
        let payloadToUse: EncryptedPayload | null = null;
        let fileNameToUse = item.fileName;
        let fileTypeToUse = item.fileType;

        if (isOnChain) {
          const contract = await getVaultContract(contractAddress);
          
          // 1. Claim share 1 on-chain for this category
          const onChainShare1 = await contract.claimVaultShare(cleanAddress, item.category);
          share1ToUse = onChainShare1;

          // 2. Download from IPFS or use manual fallback
          if (manualPayloadInput.trim()) {
            try {
              payloadToUse = parseManualPayload(manualPayloadInput, item.category);
            } catch (e: any) {
              throw new Error(`Failed to parse manual payload JSON: ${e.message}`);
            }
          } else {
            payloadToUse = await downloadFromIPFS(item.ipfsHash);
          }

          // Find file metadata from local vault list if available
          const localMatch = targetVault?.configs.find(cfg => cfg.category.toLowerCase() === item.category.toLowerCase());
          if (localMatch) {
            fileNameToUse = localMatch.fileName;
            fileTypeToUse = localMatch.fileType;
          }
        } else {
          // Simulation checks
          if (item.status !== "UNLOCKED") {
            throw new Error(`Vault category '${item.category}' is locked. Inactivity threshold not met.`);
          }
          // Load local simulated payload or manual fallback
          if (manualPayloadInput.trim()) {
            try {
              payloadToUse = parseManualPayload(manualPayloadInput, item.category);
            } catch (e: any) {
              throw new Error(`Failed to parse manual payload JSON: ${e.message}`);
            }
          } else {
            payloadToUse = await downloadFromIPFS(item.ipfsHash);
          }
        }

        if (!payloadToUse) {
          throw new Error("Encrypted payload data not found.");
        }

        const sharesToUse = [share1ToUse, recipientShareInput.trim()];
        const decrypted = await reconstructAndDecrypt(payloadToUse, sharesToUse);

        results.push({
          category: item.category,
          fileName: fileNameToUse,
          fileType: fileTypeToUse,
          content: decrypted
        });
      } catch (err: any) {
        console.error(`Decryption failed for category ${item.category}:`, err);
        errors.push(`${item.category}: ${err.reason || err.message}`);
      }
    }

    if (results.length > 0) {
      setDecryptedItems(results);
      canvasConfetti({
        particleCount: 100,
        spread: 80,
        colors: ["#faf6ee", "#e5c483", "#ddb892"]
      });
    }

    if (errors.length > 0) {
      setDecryptionError(errors.join(" | "));
    }

    setIsDecrypting(false);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedShare(key);
    setTimeout(() => setCopiedShare(null), 2000);
  };

  const downloadBackupPackage = () => {
    const backupData = {
      vaultId: createdVaultId,
      name: newVaultName,
      createdAt: Date.now(),
      configs: createdVaultConfigs.map(cfg => {
        const simulatedCid = cfg.ipfsHash.replace("ipfs://", "").trim();
        const simulatedPayload = localStorage.getItem(`ipfs_sim_${simulatedCid}`);
        return {
          ...cfg,
          rawEncryptedPayload: simulatedPayload ? JSON.parse(simulatedPayload) : null
        };
      })
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `lastwish-backup-${newVaultName.toLowerCase().replace(/\s+/g, '-') || "capsule"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const downloadBackupForVault = (v: Vault) => {
    const backupData = {
      vaultId: v.id,
      name: v.name,
      createdAt: v.createdAt,
      configs: v.configs.map(cfg => {
        const simulatedCid = cfg.ipfsHash.replace("ipfs://", "").trim();
        const simulatedPayload = localStorage.getItem(`ipfs_sim_${simulatedCid}`);
        return {
          ...cfg,
          rawEncryptedPayload: simulatedPayload ? JSON.parse(simulatedPayload) : null
        };
      })
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `lastwish-backup-${v.name.toLowerCase().replace(/\s+/g, '-') || "capsule"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const resetWizard = () => {
    setStep(1);
    setNewVaultName("");
    setWizardCategories([]);
    setEditCategory("Memories");
    setEditRecipient("");
    setEditInactivity(30);
    setEditGrace(7);
    setEditContent("");
    setUploadedFileName("");
    setUploadedFileType("");
    setCreatedVaultConfigs([]);
    setCreatedVaultId("");
    setIsWizardActive(false);
  };

  // Playground Sandbox functions
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
    <div className="flex-1 flex min-h-screen relative bg-[#090B14] text-white">
      
      {/* Background Twinkling Stars */}
      {stars.map((star, idx) => (
        <Star key={`star-${idx}`} {...star} />
      ))}

      {/* Fixed Glass Sidebar */}
      {!showLanding && isConnected && (
        <aside className="w-64 flex-shrink-0 border-r border-white/5 bg-[#121624]/75 backdrop-blur-md p-6 flex flex-col justify-between font-mono text-xs select-none">
          <div className="space-y-8">
            {/* Logo */}
            <button 
              onClick={() => { setShowLanding(true); setIsWizardActive(false); }}
              className="flex items-center space-x-3 text-left cursor-pointer bg-transparent border-0 p-0"
            >
              <span className="w-8 h-8 rounded-lg bg-[#E6BE72]/15 border border-[#E6BE72]/30 flex items-center justify-center text-[#E6BE72] font-bold text-sm">
                LW
              </span>
              <span className="text-[#faf6ee] text-base font-bold font-mono">
                LastWish
              </span>
            </button>

            {/* Navigation */}
            <nav className="space-y-1.5">
              {[
                { id: "owner", label: "Owner Dashboard", icon: LayoutDashboard, action: () => { setActiveTab("owner"); setIsWizardActive(false); } },
                { id: "my-vaults", label: "My Vaults", icon: Database, action: () => { setActiveTab("owner"); setIsWizardActive(false); setTimeout(() => { document.getElementById("vaults-container")?.scrollIntoView({ behavior: "smooth" }); }, 100); } },
                { id: "create-vault", label: "Create Legacy Vault", icon: PlusCircle, action: () => { setActiveTab("owner"); setIsWizardActive(true); setStep(1); } },
                { id: "recipient", label: "Claim Portal", icon: Unlock, action: () => { setActiveTab("recipient"); setIsWizardActive(false); } },
                { id: "inspector", label: "Vault Inspector", icon: Search, action: () => { setActiveTab("inspector"); setIsWizardActive(false); } },
                { id: "playground", label: "ZK/SSS Playground", icon: Box, action: () => { setActiveTab("playground"); setIsWizardActive(false); } },
              ].map((item) => {
                const isActive = 
                  (item.id === "owner" && activeTab === "owner" && !isWizardActive) ||
                  (item.id === "my-vaults" && activeTab === "owner" && !isWizardActive) ||
                  (item.id === "create-vault" && isWizardActive) ||
                  (item.id === "recipient" && activeTab === "recipient") ||
                  (item.id === "inspector" && activeTab === "inspector") ||
                  (item.id === "playground" && activeTab === "playground");

                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all cursor-pointer text-left border border-transparent bg-transparent font-bold ${
                      isActive 
                        ? "text-[#E6BE72] bg-[#E6BE72]/10 border-[#E6BE72]/20 shadow-[0_0_15px_rgba(230,190,114,0.1)]" 
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <item.icon className={`w-4 h-4 ${isActive ? "text-[#E6BE72]" : "text-gray-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Menu */}
          <div className="space-y-1.5 border-t border-white/5 pt-4">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer text-left border-0 bg-transparent font-bold"
            >
              <Settings className="w-4 h-4 text-gray-400" />
              <span>Settings</span>
            </button>
            <button
              onClick={() => setShowHelpModal(true)}
              className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer text-left border-0 bg-transparent font-bold"
            >
              <HelpCircle className="w-4 h-4 text-gray-400" />
              <span>Help & Support</span>
            </button>
          </div>
        </aside>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-h-screen relative w-full overflow-x-hidden">

        {/* Header Navigation */}
        <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between z-20 backdrop-blur-md bg-[#0d0f19]/80">
        {showLanding ? (
          <>
            {/* Landing Logo */}
            <button 
              onClick={() => { setShowLanding(true); setIsWizardActive(false); }}
              className="flex items-center space-x-2 text-left cursor-pointer bg-transparent border-0 p-0"
            >
              <span className="text-[#faf6ee] text-lg font-bold flex items-center space-x-1.5 font-mono">
                <span className="text-[#E6BE72]">🔒</span>
                <span>LastWish</span>
              </span>
            </button>

            {/* Landing Navigation Links */}
            <div className="hidden md:flex items-center space-x-8 font-mono text-xs">
              {[
                { id: "home", label: "Home" },
                { id: "how-it-works", label: "How it Works" },
                { id: "security", label: "Security" },
                { id: "about", label: "About" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLandingTab(tab.id as any)}
                  className={`hover:text-white transition-colors bg-transparent border-0 font-mono text-xs cursor-pointer ${
                    landingTab === tab.id ? "text-[#E6BE72] font-bold" : "text-gray-400"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center space-x-3 font-mono">
            <span className="text-[10px] text-[#E6BE72] bg-[#E6BE72]/10 px-2 py-0.5 rounded border border-[#E6BE72]/25 font-bold uppercase tracking-wider">
              {isSandboxMode ? "Simulator" : "Mainnet"}
            </span>
            <span className="text-white text-xs font-bold font-mono">
              {activeTab === "owner" ? (isWizardActive ? "Capsule Wizard" : "Owner Dashboard") : 
               activeTab === "recipient" ? "Claim Portal" : 
               activeTab === "inspector" ? "Vault Inspector" : "ZK/SSS Playground"}
            </span>
          </div>
        )}

        <div className="flex items-center space-x-3">
          {isConnected ? (
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs text-[#E6BE72] bg-[#111827]/80 px-3.5 py-1.5 rounded-full border border-white/5">
                {userAddress.substring(0, 6)}...{userAddress.substring(34)}
              </span>
              <button 
                onClick={disconnectWallet}
                className="text-xs text-[#FF5A5F] hover:text-[#FF5A5F]/80 font-bold px-3.5 py-1.5 rounded-full border border-[#FF5A5F]/20 bg-[#FF5A5F]/5 cursor-pointer font-mono"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button 
              onClick={() => connectWallet()}
              className="bg-gradient-to-r from-[#E6BE72] to-[#c5a880] text-gray-950 font-bold text-xs px-5 py-2.5 rounded-full transition-all active:scale-95 cursor-pointer shadow-lg shadow-[#E6BE72]/10 border-0"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Sandbox Warning Banner */}
      {isConnected && isSandboxMode && (
        <div className="w-full bg-[#E6BE72]/10 border-b border-[#E6BE72]/20 py-2.5 px-4 text-center text-xs text-[#E6BE72] font-mono flex items-center justify-center space-x-2 z-20">
          <AlertTriangle className="w-4 h-4 text-[#E6BE72] animate-pulse" />
          <span>MetaMask not detected. Running in Sandbox Simulation mode.</span>
        </div>
      )}

      {/* Main Container */}
      <main className={`flex-1 flex flex-col justify-center items-center p-4 md:p-8 z-10 w-full mx-auto relative ${!showLanding && isConnected ? "max-w-full" : "max-w-7xl"}`}>
        <AnimatePresence mode="wait">
          
          {/* VIEW 1: LANDING SCREEN */}
          {showLanding && (
            <motion.div
              key="landing-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center justify-between gap-16 min-h-[75vh] py-8 text-left relative"
            >
              {landingTab === "home" && (
                <>
                  {/* WebGL 3D Glass Cursor Follower Overlay */}
                  <FluidGlass scale={0.4} />

                  {/* Hero Two-Column Grid */}
              <div className="w-full flex flex-col md:flex-row items-center justify-between gap-12">
                {/* Left Column: Premium Headline & Description & Interactive CTAs */}
                <div className="flex-1 max-w-xl space-y-8 z-10">
                  <div className="space-y-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#E6BE72]/10 border border-[#E6BE72]/20 text-[#E6BE72] animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E6BE72]" />
                      Protocol v2.1 Active
                    </span>
                    
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] text-[#faf6ee] font-sans">
                      Your Digital Legacy.<br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E6BE72] via-[#E6BE72]/85 to-[#faf6ee]">
                        Secured Beyond Time.
                      </span>
                    </h1>
                    
                    <p className="text-gray-400 text-sm md:text-base leading-relaxed">
                      Store memories, important documents, and digital assets securely. LastWish ensures your legacy reaches the right people at the right moment.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                    {/* Primary CTA */}
                    <div className="relative w-full sm:w-auto">
                      {/* Floating encryption particles for CTA hover */}
                      {ctaHovered && (
                        <div className="absolute -inset-10 pointer-events-none overflow-hidden z-20">
                          <div className="absolute top-1/2 left-0 w-2 h-2 bg-[#E6BE72]/60 rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
                          <div className="absolute bottom-2 right-4 w-1.5 h-1.5 bg-[#E6BE72]/40 rounded-full animate-pulse" />
                          <div className="absolute top-2 right-8 w-2 h-2 bg-[#E6BE72]/55 rounded-full animate-[ping_1.5s_infinite]" />
                        </div>
                      )}
                      
                      <button
                        onClick={() => setShowLanding(false)}
                        onMouseEnter={() => setCtaHovered(true)}
                        onMouseLeave={() => setCtaHovered(false)}
                        className="cta-primary-glow w-full sm:w-auto bg-gradient-to-r from-[#E6BE72] to-[#c5a880] text-[#090B14] px-8 py-4 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(230,190,114,0.4)] flex items-center justify-center gap-2 group cursor-pointer border-0"
                      >
                        <span className="relative z-10 font-bold">Create Legacy Vault</span>
                        <motion.span
                          className="relative z-10 font-bold"
                          animate={{ x: ctaHovered ? 4 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          →
                        </motion.span>
                      </button>
                    </div>

                    {/* Secondary CTA */}
                    <button
                      onClick={() => setShowSecurityModal(true)}
                      className="outlined-action w-full sm:w-auto px-8 py-4 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center cursor-pointer"
                    >
                      Explore Security
                    </button>
                  </div>
                </div>

                {/* Right Column: Premium Holographic 3D Orbiting Lock Animation */}
                <div 
                  onMouseMove={handleCardMouseMove}
                  onMouseEnter={() => setIsCardHovered(true)}
                  onMouseLeave={handleCardMouseLeave}
                  className="flex-1 flex items-center justify-center relative w-full min-h-[500px] select-none cursor-default py-8"
                >
                  {/* Glowing central radial background behind lock */}
                  <div 
                    className="absolute w-80 h-80 rounded-full bg-gradient-to-r from-[#E6BE72]/10 via-transparent to-[#7C5CFF]/10 blur-3xl pointer-events-none transition-all duration-700"
                    style={{
                      transform: isCardHovered ? 'scale(1.2)' : 'scale(1)',
                      opacity: isCardHovered ? 0.95 : 0.6
                    }}
                  />

                  {/* Blurred gold & purple slow-moving ambient light blobs */}
                  <motion.div
                    style={{
                      x: bgParallaxX,
                      y: bgParallaxY,
                    }}
                    className="absolute inset-0 pointer-events-none overflow-hidden"
                  >
                    <div 
                      className="absolute top-12 left-12 w-64 h-64 rounded-full bg-[#7C5CFF]/5 blur-[100px] mix-blend-screen animate-pulse" 
                      style={{ animationDuration: '10s' }}
                    />
                    <div 
                      className="absolute bottom-12 right-12 w-72 h-72 rounded-full bg-[#E6BE72]/4 blur-[110px] mix-blend-screen animate-pulse"
                      style={{ animationDuration: '14s', animationDelay: '1.5s' }}
                    />
                  </motion.div>

                  {/* Slow drifting micro stardust particles */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {Array.from({ length: 8 }).map((_, i) => {
                      const size = Math.random() * 2 + 0.8;
                      const delay = Math.random() * 6;
                      const duration = 15 + Math.random() * 10;
                      const left = 15 + Math.random() * 70;
                      const top = 15 + Math.random() * 70;
                      return (
                        <div
                          key={i}
                          className="absolute rounded-full bg-[#E6BE72]/20 blur-[0.2px] animate-float-slow"
                          style={{
                            width: size,
                            height: size,
                            left: `${left}%`,
                            top: `${top}%`,
                            animationDelay: `${delay}s`,
                            animationDuration: `${duration}s`
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Connection Network & Orbiting Assets */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {heroAssets.map((asset, idx) => {
                      const baseAngle = (idx * 360) / heroAssets.length;
                      const orbitDuration = 24 + idx * 2.5; // slow independent speeds (24s to 36.5s per rev)
                      const radius = isCardHovered ? 168 : 160;

                      return (
                        <div
                          key={asset.id}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                          {/* 1. Orbit Rotation Container */}
                          <div
                            className="absolute w-full h-full flex items-center justify-center"
                            style={{
                              animation: `spin-clockwise ${orbitDuration}s linear infinite`,
                              transform: `rotate(${baseAngle}deg)`
                            }}
                          >
                            {/* Connection network thin line (stretches and brightens on hover) */}
                            <svg className="absolute overflow-visible pointer-events-none" style={{ width: 1, height: radius, transform: 'rotate(0deg)' }}>
                              <defs>
                                <linearGradient id={`line-glow-${idx}`} x1="0%" y1="100%" x2="0%" y2="0%">
                                  <stop offset="0%" stopColor="#E6BE72" stopOpacity="0" />
                                  <stop offset="35%" stopColor="#E6BE72" stopOpacity="0.04" />
                                  <stop offset="100%" stopColor="#E6BE72" stopOpacity="0.25" />
                                </linearGradient>
                              </defs>
                              <line 
                                x1="0" 
                                y1={radius} 
                                x2="0" 
                                y2="0" 
                                stroke={`url(#line-glow-${idx})`} 
                                strokeWidth="0.75" 
                                strokeDasharray="3 3"
                                className="transition-all duration-700"
                                style={{
                                  opacity: isCardHovered ? 0.95 : 0.65
                                }}
                              />
                            </svg>

                            {/* 2. Position wrapper at current radius */}
                            <div
                              style={{
                                transform: `translateY(-${radius}px) rotate(-${baseAngle}deg)`,
                              }}
                              className="pointer-events-auto transition-transform duration-700"
                            >
                              {/* 3. Reverse rotation wrapper to keep cards upright */}
                              <div
                                style={{
                                  animation: `spin-counter-clockwise ${orbitDuration}s linear infinite`,
                                }}
                              >
                                {/* 4. Interactive Glassmorphism Card with Parallax cursor translation */}
                                <motion.div
                                  style={{
                                    x: assetsParallaxX,
                                    y: assetsParallaxY,
                                    background: "rgba(20, 24, 38, 0.55)",
                                    backdropFilter: "blur(20px)",
                                    border: "1px solid rgba(255, 255, 255, 0.08)",
                                    boxShadow: "0 10px 35px rgba(0, 0, 0, 0.35)",
                                    borderRadius: "18px"
                                  }}
                                  whileHover={{
                                    scale: 1.08,
                                    borderColor: "rgba(230, 190, 114, 0.25)",
                                    boxShadow: "0 15px 40px rgba(230, 190, 114, 0.15)"
                                  }}
                                  className="w-14 h-14 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative group"
                                  title={asset.label}
                                >
                                  {/* Soft inner glow */}
                                  <div className="absolute inset-0 rounded-[18px] bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                                  
                                  {/* Icon container */}
                                  <div className="text-gray-300 group-hover:text-[#E6BE72] transition-colors duration-300 flex items-center justify-center">
                                    <asset.icon className="w-5 h-5" />
                                  </div>
                                </motion.div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Central Lock Element with Pulse, float bobbing, and custom golden styling */}
                  <motion.div
                    style={{
                      x: lockParallaxX,
                      y: lockParallaxY,
                      transformStyle: "preserve-3d",
                      perspective: 1000,
                      z: 50
                    }}
                    animate={{
                      y: [0, -4, 0],
                      rotate: [0, 1.5, 0, -1.5, 0],
                    }}
                    transition={{
                      y: {
                        repeat: Infinity,
                        duration: 5.5,
                        ease: "easeInOut"
                      },
                      rotate: {
                        repeat: Infinity,
                        duration: 11,
                        ease: "easeInOut"
                      }
                    }}
                    className="relative z-30 flex items-center justify-center p-8 rounded-full cursor-pointer"
                  >
                    {/* Glowing lock ring backing */}
                    <div 
                      className="absolute -inset-8 rounded-full bg-gradient-to-r from-[#E6BE72]/15 to-[#7C5CFF]/15 blur-2xl pointer-events-none transition-all duration-700"
                      style={{
                        transform: isCardHovered ? 'scale(1.2)' : 'scale(1)',
                        opacity: isCardHovered ? 0.9 : 0.65
                      }}
                    />

                    {/* Highly polished golden reflection lock body SVG */}
                    <svg viewBox="0 0 120 120" className="w-24 h-24 drop-shadow-[0_0_35px_rgba(230,190,114,0.4)] transition-transform duration-500 hover:scale-105">
                      <defs>
                        {/* Gold Metallic Gradients */}
                        <linearGradient id="gold-metallic" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#FFF1D0" />
                          <stop offset="30%" stopColor="#E6BE72" />
                          <stop offset="70%" stopColor="#9C7A3C" />
                          <stop offset="100%" stopColor="#F5D797" />
                        </linearGradient>
                        <linearGradient id="gold-shackle" x1="100%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#E6BE72" />
                          <stop offset="50%" stopColor="#FFF5DF" />
                          <stop offset="100%" stopColor="#B39252" />
                        </linearGradient>
                        {/* Dark Inner Shield */}
                        <linearGradient id="lock-inner" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#1E2030" />
                          <stop offset="100%" stopColor="#0B0C15" />
                        </linearGradient>
                        {/* Gold Bevel highlight */}
                        <linearGradient id="gold-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#FFF" stopOpacity="0.8" />
                          <stop offset="50%" stopColor="#E6BE72" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#9C7A3C" stopOpacity="0.9" />
                        </linearGradient>
                      </defs>

                      {/* Shackle */}
                      <path
                        d="M 36 45 L 36 28 C 36 15, 84 15, 84 28 L 84 45"
                        fill="none"
                        stroke="url(#gold-shackle)"
                        strokeWidth="8"
                        strokeLinecap="round"
                      />

                      {/* Main Lock Body */}
                      <rect
                        x="18"
                        y="40"
                        width="84"
                        height="64"
                        rx="16"
                        fill="url(#gold-stroke)"
                      />
                      <rect
                        x="20"
                        y="42"
                        width="80"
                        height="60"
                        rx="14"
                        fill="url(#gold-metallic)"
                      />
                      
                      {/* Beveled Inner Shield */}
                      <rect
                        x="26"
                        y="48"
                        width="68"
                        height="48"
                        rx="10"
                        fill="url(#lock-inner)"
                        stroke="#9C7A3C"
                        strokeWidth="1.5"
                      />

                      {/* Lock Core Details */}
                      <circle cx="60" cy="70" r="7" fill="url(#gold-metallic)" />
                      <path
                        d="M 60 70 L 60 85"
                        stroke="url(#gold-metallic)"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                      
                      {/* Central pulsing core glow */}
                      <circle cx="60" cy="70" r="2.5" fill="#FFF" className="animate-pulse" />
                    </svg>
                  </motion.div>
                </div>
              </div>

              {/* Bottom Feature Cards */}
              <div className="w-full grid grid-cols-2 md:grid-cols-5 gap-4 pt-12 border-t border-white/5">
                {[
                  { title: "End-to-End Encryption", desc: "Client-side AES-256-GCM protection.", icon: Shield },
                  { title: "Shamir Secret Sharing", desc: "Split keys mathematically across shares.", icon: Key },
                  { title: "Decentralized Storage", desc: "Files hosted on redundant IPFS network.", icon: Upload },
                  { title: "Smart Contracts", desc: "Heartbeat verification on Base Sepolia.", icon: Lock },
                  { title: "Multi-Recipient Support", desc: "Separate rules for separate beneficiaries.", icon: Mail }
                ].map((f, idx) => (
                  <motion.div
                    key={idx}
                    whileHover={{ y: -6, borderColor: 'rgba(230,190,114,0.35)' }}
                    className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col justify-between text-left space-y-3 cursor-default"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#E6BE72]/10 border border-[#E6BE72]/20 flex items-center justify-center text-[#E6BE72]">
                      <f.icon className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-white font-mono">{f.title}</h4>
                      <p className="text-[10px] text-gray-400 leading-normal font-sans">{f.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          {landingTab === "how-it-works" && (
            <div className="w-full max-w-4xl mx-auto space-y-8 font-mono">
              <div className="text-center space-y-3 pb-4">
                <span className="text-[10px] text-[#E6BE72] uppercase tracking-widest font-bold bg-[#E6BE72]/10 border border-[#E6BE72]/20 px-3 py-1 rounded-full">
                  Step-By-Step Mechanics
                </span>
                <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">Decentralized Key Reconstruction</h2>
                <p className="text-xs md:text-sm text-gray-400 max-w-xl mx-auto">
                  How your encrypted data is safely created, preserved, and handed over without any central servers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  {
                    step: "01",
                    title: "Client-Side AES Encryption",
                    desc: "Your files and messages are encrypted directly inside your web browser using a dynamically generated AES-256 key before any upload occurs."
                  },
                  {
                    step: "02",
                    title: "Shamir's Key Splitting",
                    desc: "The AES key is split into 3 mathematical shares using Shamir's Secret Sharing. Decryption requires a threshold of any 2 of the 3 shares."
                  },
                  {
                    step: "03",
                    title: "Redundant IPFS Storage",
                    desc: "The encrypted file payload is uploaded directly to the IPFS network, yielding a secure CID. No central server ever holds the file."
                  },
                  {
                    step: "04",
                    title: "Base Sepolia Heartbeat",
                    desc: "A smart contract monitors check-ins. If the heartbeat expires, the designated heir is permitted to fetch Share 1 and reconstruct your key."
                  }
                ].map((s, idx) => (
                  <div key={idx} className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 hover:border-[#E6BE72]/30 transition-all duration-300">
                    <div className="text-2xl font-extrabold text-[#E6BE72]">{s.step}</div>
                    <h4 className="text-sm font-bold text-white leading-snug">{s.title}</h4>
                    <p className="text-[10px] text-gray-400 leading-relaxed font-sans">{s.desc}</p>
                  </div>
                ))}
              </div>

              <div className="p-6 glass-panel rounded-[2rem] border border-white/5 text-center space-y-4 max-w-2xl mx-auto mt-4">
                <h4 className="text-sm font-extrabold text-white">Ready to secure your legacy capsule?</h4>
                <p className="text-[10px] text-gray-400 font-sans max-w-md mx-auto">
                  Create your memory capsule now. Setup takes under 5 minutes, backed by cryptographically secure open-source smart contracts.
                </p>
                <button 
                  onClick={() => { setShowLanding(false); }}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#E6BE72] to-[#c5a880] text-gray-950 font-bold rounded-full text-xs transition-all hover:scale-105 active:scale-95 cursor-pointer border-0 inline-block font-mono"
                >
                  Connect Wallet & Start
                </button>
              </div>
            </div>
          )}

          {landingTab === "security" && (
            <div className="w-full max-w-4xl mx-auto space-y-8 font-mono">
              <div className="text-center space-y-3 pb-4">
                <span className="text-[10px] text-[#2ECC71] uppercase tracking-widest font-bold bg-[#2ECC71]/10 border border-[#2ECC71]/20 px-3 py-1 rounded-full">
                  Zero-Custody Cryptography
                </span>
                <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">Trustless Security Architecture</h2>
                <p className="text-xs md:text-sm text-gray-400 max-w-xl mx-auto">
                  Review the mathematics and protocols behind our zero-knowledge inheritance infrastructure.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    title: "100% Zero Custody",
                    desc: "We never transmit private keys, raw files, or secret text to any centralized database. All cryptographic transformations occur in local browser memory. Even if our frontend hosting is compromised, your secrets remain unreadable."
                  },
                  {
                    title: "2-of-3 Threshold Math",
                    desc: "By dividing the decryption key into 3 shards, we eliminate single points of vulnerability. Shard 1 is held on-chain. Shard 2 is handed to your heir. Shard 3 remains on your local disk as a cold standby. An adversary needs 2 shards to decrypt."
                  },
                  {
                    title: "Auditable Smart Contracts",
                    desc: "The release timer and check-in pulses are managed strictly by autonomous smart contracts on Base Sepolia. The contract cannot be modified or overridden, guaranteeing that your wishes are executed exactly as written."
                  }
                ].map((sec, idx) => (
                  <div key={idx} className="glass-panel p-6 rounded-3xl border border-white/5 space-y-3 hover:border-blue-500/30 transition-all duration-300">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2">
                      <Shield className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-white">{sec.title}</h4>
                    <p className="text-[11px] text-gray-400 leading-relaxed font-sans">{sec.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {landingTab === "about" && (
            <div className="w-full max-w-3xl mx-auto space-y-8 font-mono">
              <div className="text-center space-y-3 pb-4">
                <span className="text-[10px] text-blue-400 uppercase tracking-widest font-bold bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
                  Our Mission
                </span>
                <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">Secure Digital Continuity</h2>
                <p className="text-xs md:text-sm text-gray-400 max-w-md mx-auto">
                  Conceived and built to ensure your digital legacy survives the unexpected.
                </p>
              </div>

              <div className="glass-panel p-8 rounded-[2rem] border border-white/5 space-y-6">
                <p className="text-xs md:text-sm text-gray-300 leading-relaxed font-sans">
                  Currently, billions of dollars in crypto-assets, priceless personal letters, legal declarations, and historical memoirs are lost forever due to sudden hardware loss, forgotten passwords, or unexpected occurrences.
                </p>
                <p className="text-xs md:text-sm text-gray-300 leading-relaxed font-sans">
                  LastWish was developed for the <strong>Confluence 2.0 Hackathon</strong> to offer a trustless, zero-knowledge alternative to traditional centralized safety deposits or custodian platforms. By combining the immutability of the Ethereum Virtual Machine (EVM) with local Shamir Secret Sharing, we provide digital continuity without compromising on security or sovereignty.
                </p>

                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-6 text-[11px]">
                  <div>
                    <span className="text-gray-500 block uppercase font-bold tracking-wider">Built For</span>
                    <p className="text-white font-bold mt-0.5">Confluence 2.0 Hackathon</p>
                  </div>
                  <div>
                    <span className="text-gray-500 block uppercase font-bold tracking-wider">Deployment Network</span>
                    <p className="text-white font-bold mt-0.5">Base Sepolia Testnet</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
          )}

          {/* VIEW 2: CONNECT WALLET CARD */}
          {!showLanding && !isConnected && (
            <motion.div
              key="connect-wallet-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="glass-panel p-8 md:p-12 rounded-3xl max-w-lg w-full text-center space-y-8 my-auto"
            >
              <h2 className="text-3xl font-extrabold tracking-tight text-[#e5c483] font-mono uppercase">
                Secure Your Legacy
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
              transition={{ duration: 0.45 }}
              className="w-full mx-auto py-6"
            >
              <AnimatePresence mode="wait">
                
                {/* Tab 1: Owner Dashboard */}
                {activeTab === "owner" && (
                  <motion.div
                    key="owner-tab-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {!isWizardActive && (
                      <motion.div
                        key="dashboard-main"
                        className="space-y-6 text-left"
                      >
                        {/* Welcome back Keeper */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
                          <div>
                            <h2 className="text-3xl font-extrabold text-[#faf6ee] tracking-tight leading-tight">Welcome back 👋</h2>
                            <p className="text-xs text-gray-400 font-mono mt-1">Manage your encrypted digital legacy securely.</p>
                          </div>
                          <div className="flex items-center space-x-2 bg-[#111827]/60 border border-white/5 px-4 py-2 rounded-full font-mono text-[10px] text-[#2ECC71]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2ECC71] animate-pulse" />
                            <span className="text-[#faf6ee]">Base Sepolia Network</span>
                          </div>
                        </div>

                        {/* Stats Grid Row */}
                        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                          {/* Stats Grid */}
                          <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Card 1: Total Vaults */}
                            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3 cursor-default glow-purple relative overflow-hidden group">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                                <Shield className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-500 font-mono uppercase block font-bold">Total Vaults</span>
                                <div className="text-3xl font-extrabold font-mono text-[#faf6ee] mt-1">
                                  {vaults.length}
                                </div>
                              </div>
                            </div>

                            {/* Card 2: Recipients */}
                            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3 cursor-default glow-blue relative overflow-hidden group">
                              <div className="w-8 h-8 rounded-lg bg-[#2ECC71]/10 border border-[#2ECC71]/20 flex items-center justify-center text-[#2ECC71]">
                                <Plus className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-500 font-mono uppercase block font-bold">Recipients</span>
                                <div className="text-3xl font-extrabold font-mono text-[#faf6ee] mt-1">
                                  {Array.from(new Set(vaults.flatMap(v => v.configs.map(c => c.recipientAddress.toLowerCase())))).length}
                                </div>
                              </div>
                            </div>

                            {/* Card 3: Encrypted Assets */}
                            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3 cursor-default glow-gold relative overflow-hidden group">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                                <Lock className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-500 font-mono uppercase block font-bold">Encrypted Assets</span>
                                <div className="text-3xl font-extrabold font-mono text-[#faf6ee] mt-1">
                                  100%
                                </div>
                              </div>
                            </div>

                            {/* Card 4: Active Vaults */}
                            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3 cursor-default glow-green relative overflow-hidden group">
                              <div className="w-8 h-8 rounded-lg bg-[#E6BE72]/10 border border-[#E6BE72]/20 flex items-center justify-center text-[#E6BE72]">
                                <Activity className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-500 font-mono uppercase block font-bold">Active Vaults</span>
                                <div className="text-3xl font-extrabold font-mono text-[#faf6ee] mt-1">
                                  {vaults.filter(v => v.configs.some(c => c.status === "ACTIVE")).length}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions Card */}
                          <div className="xl:col-span-1 glass-panel p-5 rounded-2xl border border-white/5 space-y-4 cursor-default flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] text-[#E6BE72] font-mono uppercase block font-bold tracking-wider">⚡ Quick Actions</span>
                              <p className="text-[10px] text-gray-400 font-mono mt-1.5 leading-relaxed">
                                Broadcast a network-wide proof-of-life heartbeat signal to keep all of your active capsules secure.
                              </p>
                            </div>
                            <button 
                              onClick={triggerGlobalHeartbeat}
                              className="w-full py-3.5 bg-gradient-to-r from-[#E6BE72] to-[#c5a880] text-gray-950 hover:scale-[1.01] active:scale-[0.99] font-bold rounded-xl transition-all cursor-pointer text-center flex items-center justify-center space-x-2 border-0 font-mono text-[11px] shadow-lg shadow-[#E6BE72]/5"
                            >
                              <span>💓</span>
                              <span>Send Global Heartbeat</span>
                            </button>
                          </div>
                        </div>

                        {/* Dashboard Main Grid Split */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="vaults-container">
                          
                          {/* Left Column: Vault Cards List (Span 2) */}
                          <div className="lg:col-span-2 space-y-6">
                            <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 relative">
                              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                <div className="flex items-center space-x-2">
                                  <Database className="w-4 h-4 text-[#E6BE72]" />
                                  <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Your Legacy Vaults</h4>
                                </div>
                                <button 
                                  onClick={() => { setIsWizardActive(true); setStep(1); }}
                                  className="px-4 py-2 bg-gradient-to-r from-[#E6BE72] to-[#c5a880] text-gray-950 font-bold rounded-full text-[10px] font-mono transition-all hover:scale-105 active:scale-95 cursor-pointer border-0"
                                >
                                  + Create New Vault
                                </button>
                              </div>

                              {/* Vaults list dashboard display */}
                              {vaults.length > 0 ? (
                                <div className="space-y-4">
                                  {vaults.map(v => {
                                    const elapsed = Math.floor((Date.now() - v.lastHeartbeat) / 1000);
                                    
                                    return (
                                      <div key={v.id} className="p-5 bg-[#090B14]/40 border border-white/5 rounded-2xl space-y-4 hover:border-[#E6BE72]/30 transition-all duration-300 text-left">
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-white/5 pb-3 font-mono text-xs">
                                          <div>
                                            <h5 className="font-extrabold text-white text-sm font-mono">{v.name}</h5>
                                            <div className="flex items-center space-x-1.5 mt-1">
                                              <p className="text-[9px] text-gray-500 font-mono">Capsule ID: {v.id.slice(0, 14)}...{v.id.slice(-6)}</p>
                                              <button 
                                                onClick={() => copyToClipboard(v.id, `v-id-${v.id}`)}
                                                className="p-0.5 text-gray-500 hover:text-[#E6BE72] rounded transition-colors cursor-pointer bg-transparent border-0 p-0"
                                                title="Copy Vault ID"
                                              >
                                                {copiedShare === `v-id-${v.id}` ? (
                                                  <Check className="w-3 h-3 text-[#2ECC71]" />
                                                ) : (
                                                  <Copy className="w-3 h-3" />
                                                )}
                                              </button>
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => { setInspectVaultId(v.id); queryOnChainVault({ preventDefault: () => {} } as any); setActiveTab("inspector"); }}
                                              className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-bold font-mono transition-all cursor-pointer"
                                            >
                                              Inspect
                                            </button>
                                            <button
                                              onClick={() => triggerHeartbeat(v.id)}
                                              className="px-3 py-1.5 bg-[#E6BE72]/10 hover:bg-[#E6BE72]/20 border border-[#E6BE72]/25 text-[#E6BE72] rounded-xl text-[10px] font-bold font-mono transition-all cursor-pointer"
                                              title="Reset inactivity countdown on smart contract"
                                            >
                                              Heartbeat
                                            </button>
                                            <button
                                              onClick={() => triggerVeto(v.id)}
                                              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/25 rounded-xl text-[10px] font-bold font-mono transition-all cursor-pointer"
                                              title="Trigger Veto to extend grace period"
                                            >
                                              Veto
                                            </button>
                                            <button
                                              onClick={() => downloadBackupForVault(v)}
                                              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-[#2ECC71] border border-[#2ECC71]/25 rounded-xl text-[10px] font-bold font-mono transition-all cursor-pointer"
                                              title="Export encrypted JSON backup file containing payload and beneficiary shares"
                                            >
                                              Export JSON
                                            </button>
                                            <button
                                              onClick={() => deleteVault(v.id)}
                                              className="p-2 bg-red-500/5 hover:bg-red-500/15 text-[#FF5A5F] border border-red-500/10 hover:border-red-500/25 rounded-xl cursor-pointer border-0"
                                              title="Delete Vault"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>

                                        {/* Categories list in vault */}
                                        <div className="space-y-2">
                                          <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold font-mono">Active Escrows</span>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {v.configs.map((cfg, idx) => {
                                              const cdown = Math.max(0, cfg.inactivityPeriod - elapsed);
                                              const gdown = Math.max(0, (cfg.inactivityPeriod + cfg.gracePeriod) - elapsed);
                                              
                                              return (
                                                <div key={idx} className="p-3 bg-[#090B14]/80 border border-white/5 rounded-xl flex items-center justify-between font-mono text-[10px] gap-2">
                                                  <div>
                                                    <span className="font-bold text-gray-300">{cfg.category}</span>
                                                    <p className="text-[8px] text-gray-500 mt-0.5">Heir: {cfg.recipientAddress.slice(0, 6)}...{cfg.recipientAddress.slice(-4)}</p>
                                                  </div>
                                                  <div className="text-right">
                                                    {cfg.status === "ACTIVE" && <span className="text-[#2ECC71] font-bold">{cdown}s left</span>}
                                                    {cfg.status === "PENDING_UNLOCK" && <span className="text-amber-500 animate-pulse font-bold">Grace ({gdown}s)</span>}
                                                    {cfg.status === "UNLOCKED" && <span className="text-[#FF5A5F] font-bold">Released</span>}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="p-8 text-center bg-[#090B14]/40 border border-white/5 rounded-2xl text-gray-500 text-xs font-mono">
                                  No active memory capsules found. Click above to deploy one.
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Column: Health Status & Activity timeline (Span 1) */}
                          <div className="space-y-6">
                            {/* System Status Panel */}
                            <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
                              <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider border-b border-white/5 pb-2">Protocol Status</h4>
                              
                              <div className="space-y-2.5 font-mono text-[10px]">
                                {[
                                  { name: "Wallet Connected", ok: isConnected, icon: Wallet },
                                  { name: "Smart Contract Connected", ok: isConnected, icon: Lock },
                                  { name: "Encryption Active", ok: true, icon: Shield },
                                  { name: "IPFS Online", ok: true, icon: Upload },
                                  { name: "Heartbeat Running", ok: vaults.length > 0, icon: Activity },
                                  { name: "Recipient Ready", ok: true, icon: CheckCircle2 }
                                ].map((status, idx) => (
                                  <div key={idx} className="flex justify-between items-center p-2.5 bg-[#090B14]/40 border border-white/5 rounded-xl">
                                    <div className="flex items-center space-x-2 text-gray-400">
                                      <status.icon className="w-3.5 h-3.5 text-[#E6BE72]" />
                                      <span>{status.name}</span>
                                    </div>
                                    <div className="flex items-center space-x-1.5">
                                      <span className={`w-1.5 h-1.5 rounded-full ${status.ok ? "bg-[#2ECC71] animate-pulse" : "bg-gray-600"}`} />
                                      <span className={status.ok ? "text-[#2ECC71] font-bold" : "text-gray-500"}>
                                        {status.ok ? "ONLINE" : "OFFLINE"}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Recent Activity Card */}
                            <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
                              <h4 className="text-xs font-bold text-[#faf6ee] font-mono uppercase tracking-wider border-b border-white/5 pb-2">Recent Logs</h4>
                              
                              <div className="space-y-4 text-left font-mono text-[10px]">
                                {[
                                  { label: "IPFS Gateway synced", desc: "Redundant cluster handshake ok", time: "just now", color: "bg-blue-400" },
                                  { label: "Encrypted memory session initialized", desc: "AES-256 local keys cached", time: "2 min ago", color: "bg-[#E6BE72]" },
                                  { label: "Heartbeat timer reset on-chain", desc: "Contract tx confirmed success", time: "1 hr ago", color: "bg-[#2ECC71]" }
                                ].map((log, lIdx) => (
                                  <div key={lIdx} className="flex gap-3 items-start relative">
                                    <div className={`w-1.5 h-1.5 rounded-full mt-1 relative z-10 flex-shrink-0 ${log.color}`} />
                                    <div className="space-y-0.5">
                                      <p className="text-gray-300 font-bold leading-normal">{log.label}</p>
                                      <p className="text-gray-500 text-[9px] leading-normal">{log.desc}</p>
                                      <span className="text-[8px] text-[#E6BE72]/60 uppercase tracking-widest">{log.time}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                        </div>
                      </motion.div>
                    )}
                               {/* Wizard Step 1: Vault Name & Content Type Selection */}
                    {isWizardActive && step === 1 && (
                      <motion.div
                        key="wizard-step-1"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="glass-panel p-8 md:p-12 rounded-[2rem] max-w-3xl w-full mx-auto space-y-8 relative border border-[#E6BE72]/20 shadow-2xl text-left"
                      >
                        {/* Stepper progress indicator */}
                        <div className="w-full flex items-center justify-between border-b border-white/5 pb-6">
                          <div className="flex items-center space-x-3">
                            <span className="text-[9px] text-[#E6BE72] font-mono uppercase tracking-widest font-bold">Capsule Wizard</span>
                            <h2 className="text-xl font-bold text-white">Create Capsule</h2>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-[10px] text-gray-400">
                            <span className="text-[#E6BE72] font-bold">1</span> / 4
                          </div>
                        </div>

                        <div className="space-y-6">
                          {/* Vault Name Input */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Capsule Name</label>
                            <input 
                              type="text" 
                              placeholder="e.g. My Eternal Legacy Capsule"
                              value={newVaultName}
                              onChange={(e) => setNewVaultName(e.target.value)}
                              className="w-full design-input px-5 py-4 text-xs font-mono"
                            />
                          </div>

                          {/* Content Types Selection Grid */}
                          <div className="space-y-3">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Select Default Content Category</label>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Card 1: Personal Message */}
                              <motion.div
                                onClick={() => setEditCategory("Memories")}
                                whileHover={{ y: -4 }}
                                className={`relative p-5 border rounded-2xl cursor-pointer transition-all duration-300 flex items-start gap-4 select-none ${
                                  editCategory === "Memories" ? "bg-[#111827]/85 border-[#E6BE72]/50 shadow-[0_10px_25px_rgba(230,190,114,0.15)]" : "bg-[#111827]/30 border-white/5"
                                }`}
                              >
                                <div className="p-3 bg-[#E6BE72]/10 border border-[#E6BE72]/20 rounded-xl text-[#E6BE72] relative overflow-hidden flex-shrink-0">
                                  {editCategory === "Memories" && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center font-mono text-[7px] text-[#E6BE72]/40 overflow-hidden pointer-events-none select-none">
                                      <div className="animate-pulse">MEM</div>
                                    </div>
                                  )}
                                  <Mail className="w-5 h-5 z-10 relative" />
                                </div>
                                <div className="space-y-1">
                                  <h4 className="text-xs font-bold text-[#faf6ee] font-mono">Personal Message</h4>
                                  <p className="text-[11px] text-gray-400 font-sans">Letters, memories, final words</p>
                                </div>
                              </motion.div>

                              {/* Card 2: Documents */}
                              <motion.div
                                onClick={() => setEditCategory("Medical")}
                                whileHover={{ y: -4 }}
                                className={`relative p-5 border rounded-2xl cursor-pointer transition-all duration-300 flex items-start gap-4 select-none ${
                                  editCategory === "Medical" ? "bg-[#111827]/85 border-[#E6BE72]/50 shadow-[0_10px_25px_rgba(230,190,114,0.15)]" : "bg-[#111827]/30 border-white/5"
                                }`}
                              >
                                <div className="p-3 bg-[#E6BE72]/10 border border-[#E6BE72]/20 rounded-xl text-[#E6BE72] relative overflow-hidden flex-shrink-0">
                                  {editCategory === "Medical" && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center font-mono text-[7px] text-[#E6BE72]/40 overflow-hidden pointer-events-none select-none">
                                      <div className="animate-pulse">DOC</div>
                                    </div>
                                  )}
                                  <Lock className="w-5 h-5 z-10 relative" />
                                </div>
                                <div className="space-y-1">
                                  <h4 className="text-xs font-bold text-[#faf6ee] font-mono">Documents</h4>
                                  <p className="text-[11px] text-gray-400 font-sans">Important files and records</p>
                                </div>
                              </motion.div>

                              {/* Card 3: Financial Instructions */}
                              <motion.div
                                onClick={() => setEditCategory("Finances")}
                                whileHover={{ y: -4 }}
                                className={`relative p-5 border rounded-2xl cursor-pointer transition-all duration-300 flex items-start gap-4 select-none ${
                                  editCategory === "Finances" ? "bg-[#111827]/85 border-[#E6BE72]/50 shadow-[0_10px_25px_rgba(230,190,114,0.15)]" : "bg-[#111827]/30 border-white/5"
                                }`}
                              >
                                <div className="p-3 bg-[#E6BE72]/10 border border-[#E6BE72]/20 rounded-xl text-[#E6BE72] relative overflow-hidden flex-shrink-0">
                                  {editCategory === "Finances" && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center font-mono text-[7px] text-[#E6BE72]/40 overflow-hidden pointer-events-none select-none">
                                      <div className="animate-pulse">FIN</div>
                                    </div>
                                  )}
                                  <Wallet className="w-5 h-5 z-10 relative" />
                                </div>
                                <div className="space-y-1">
                                  <h4 className="text-xs font-bold text-[#faf6ee] font-mono">Financial Instructions</h4>
                                  <p className="text-[11px] text-gray-400 font-sans">Digital asset guidance</p>
                                </div>
                              </motion.div>

                              {/* Card 4: Crypto Legacy */}
                              <motion.div
                                onClick={() => setEditCategory("Credentials")}
                                whileHover={{ y: -4 }}
                                className={`relative p-5 border rounded-2xl cursor-pointer transition-all duration-300 flex items-start gap-4 select-none ${
                                  editCategory === "Credentials" ? "bg-[#111827]/85 border-[#E6BE72]/50 shadow-[0_10px_25px_rgba(230,190,114,0.15)]" : "bg-[#111827]/30 border-white/5"
                                }`}
                              >
                                <div className="p-3 bg-[#E6BE72]/10 border border-[#E6BE72]/20 rounded-xl text-[#E6BE72] relative overflow-hidden flex-shrink-0">
                                  {editCategory === "Credentials" && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center font-mono text-[7px] text-[#E6BE72]/40 overflow-hidden pointer-events-none select-none">
                                      <div className="animate-pulse">WEB3</div>
                                    </div>
                                  )}
                                  <Box className="w-5 h-5 z-10 relative" />
                                </div>
                                <div className="space-y-1">
                                  <h4 className="text-xs font-bold text-[#faf6ee] font-mono">Crypto Legacy</h4>
                                  <p className="text-[11px] text-gray-400 font-sans">Web3 inheritance details</p>
                                </div>
                              </motion.div>
                            </div>
                          </div>

                          <div className="pt-4 flex justify-between items-center gap-4">
                            <button onClick={() => setIsWizardActive(false)} className="text-xs text-gray-500 hover:text-white font-mono cursor-pointer bg-transparent border-0">
                              ✕ CANCEL SETUP
                            </button>
                            <button 
                              onClick={() => setStep(2)}
                              disabled={!newVaultName || !editCategory}
                              className="w-full sm:w-auto bg-gradient-to-r from-[#E6BE72] to-[#c5a880] text-gray-950 font-bold px-8 py-3.5 rounded-full text-xs transition-all uppercase tracking-wider cursor-pointer shadow-lg disabled:opacity-40 border-0"
                            >
                              CONTINUE SETUP →
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Wizard Step 2: Configure Recipients & Upload Files */}
                    {isWizardActive && step === 2 && (
                      <motion.div
                        key="wizard-step-2"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="glass-panel p-8 md:p-12 rounded-[2rem] max-w-3xl w-full mx-auto space-y-8 relative border border-[#E6BE72]/20 shadow-2xl text-left"
                      >
                        {/* Stepper progress indicator */}
                        <div className="w-full flex items-center justify-between border-b border-white/5 pb-6">
                          <div className="flex items-center space-x-3">
                            <span className="text-[9px] text-[#E6BE72] font-mono uppercase tracking-widest font-bold">Capsule Wizard</span>
                            <h2 className="text-xl font-bold text-white">Configure Escrows</h2>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-[10px] text-gray-400">
                            <span className="text-[#E6BE72] font-bold">2</span> / 4
                          </div>
                        </div>

                        <div className="space-y-6">
                          {/* Configured categories preview list */}
                          {wizardCategories.length > 0 && (
                            <div className="space-y-2.5 p-4 bg-[#090B14]/60 border border-white/5 rounded-2xl max-h-48 overflow-y-auto">
                              <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-bold font-mono">Designated Beneficiaries</span>
                              <div className="grid grid-cols-1 gap-2">
                                {wizardCategories.map(c => (
                                  <div key={c.id} className="p-3 bg-[#111827]/60 border border-white/5 rounded-xl flex items-center justify-between text-xs font-mono">
                                    <div>
                                      <span className="text-white font-bold">{c.category} Escrow</span>
                                      <p className="text-[9px] text-gray-500">Beneficiary: {c.recipient.substring(0, 8)}...{c.recipient.substring(36)}</p>
                                      {c.fileName && <p className="text-[9px] text-[#2ECC71] mt-0.5">📄 {c.fileName} ({Math.round(c.content.length / 1024)} KB)</p>}
                                    </div>
                                    <button 
                                      onClick={() => removeCategoryFromWizard(c.id)} 
                                      className="text-[#FF5A5F] hover:text-[#FF5A5F]/80 p-1 font-bold text-[10px] cursor-pointer bg-transparent border-0"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Dynamic Add Config Block */}
                          <div className="p-5 bg-[#090B14]/40 border border-white/5 rounded-3xl space-y-4 font-mono">
                            <span className="text-[10px] text-[#E6BE72] font-bold uppercase tracking-widest block">Add Category Escrow Rule</span>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[9px] text-gray-500 uppercase tracking-wider block font-bold">Category</label>
                                <select 
                                  value={editCategory}
                                  onChange={(e) => setEditCategory(e.target.value)}
                                  className="w-full design-input px-3.5 py-3 text-xs bg-gray-950 border-white/5"
                                >
                                  <option value="Memories">❤️ Memories</option>
                                  <option value="Finances">💰 Finances</option>
                                  <option value="Medical">🏥 Medical</option>
                                  <option value="Credentials">🔑 Credentials</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] text-gray-500 uppercase tracking-wider block font-bold">Beneficiary Address</label>
                                <input 
                                  type="text" 
                                  placeholder="0x..."
                                  value={editRecipient}
                                  onChange={(e) => setEditRecipient(e.target.value)}
                                  className="w-full design-input px-3.5 py-3 text-xs"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[9px] text-gray-500 uppercase tracking-wider block font-bold">Inactivity Countdown</label>
                                <select 
                                  value={editInactivity}
                                  onChange={(e) => setEditInactivity(Number(e.target.value))}
                                  className="w-full design-input px-3.5 py-3 text-xs bg-gray-950 border-white/5"
                                >
                                  <option value="15">15s (Demo)</option>
                                  <option value="30">30s (Demo)</option>
                                  <option value="60">60s (Demo)</option>
                                  <option value="300">5 min</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] text-gray-500 uppercase tracking-wider block font-bold">Veto Grace Period</label>
                                <select 
                                  value={editGrace}
                                  onChange={(e) => setEditGrace(Number(e.target.value))}
                                  className="w-full design-input px-3.5 py-3 text-xs bg-gray-950 border-white/5"
                                >
                                  <option value="5">5s (Demo)</option>
                                  <option value="15">15s (Demo)</option>
                                  <option value="30">30s (Demo)</option>
                                  <option value="60">60s (Demo)</option>
                                </select>
                              </div>
                            </div>

                            {/* Content type toggle */}
                            <div className="space-y-2">
                              <label className="text-[9px] text-gray-500 uppercase tracking-wider block font-bold">Payload format</label>
                              <div className="flex p-1 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-md">
                                <button
                                  type="button"
                                  onClick={() => { setEditContentType("text"); setEditContent(""); }}
                                  className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-all duration-200 cursor-pointer border-0 ${
                                    editContentType === "text" 
                                      ? "bg-white/10 text-white border border-white/10 shadow-[0_2px_8px_rgba(255,255,255,0.02)] font-extrabold" 
                                      : "text-gray-500 hover:text-white bg-transparent"
                                  }`}
                                >
                                  Text Memoir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditContentType("file"); setEditContent(""); }}
                                  className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-all duration-200 cursor-pointer border-0 ${
                                    editContentType === "file" 
                                      ? "bg-white/10 text-white border border-white/10 shadow-[0_2px_8px_rgba(255,255,255,0.02)] font-extrabold" 
                                      : "text-gray-500 hover:text-white bg-transparent"
                                  }`}
                                >
                                  Upload Document / Media
                                </button>
                              </div>
                            </div>

                            {editContentType === "text" ? (
                              <div className="space-y-1">
                                <label className="text-[9px] text-gray-500 uppercase tracking-wider block font-bold">Legacy Text content</label>
                                <textarea 
                                  placeholder="Write secret messages, instructions, or credentials here..."
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  rows={3}
                                  className="w-full design-input p-3.5 text-xs resize-none"
                                />
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <label className="text-[9px] text-gray-500 uppercase tracking-wider block font-bold">Drag and Drop Document / Media (Max 2MB)</label>
                                <div className="border border-dashed border-white/10 rounded-2xl p-6 text-center bg-[#090B14]/40 hover:border-[#E6BE72]/20 transition-all relative">
                                  <input 
                                    type="file" 
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                  <Upload className="w-6 h-6 mx-auto text-gray-500 mb-2" />
                                  <span className="text-[10px] text-gray-400 block truncate">
                                    {uploadedFileName ? `Selected file: ${uploadedFileName}` : "Drag and drop PDF, PNG, JPG, MP3, MP4 or click to select"}
                                  </span>
                                </div>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={addCategoryToWizard}
                              disabled={!editRecipient || !editContent}
                              className="w-full bg-[#111827] border border-white/10 hover:border-[#E6BE72]/30 text-[#E6BE72] font-bold py-3 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-40"
                            >
                              + Add Category Rule
                            </button>
                          </div>

                          <div className="pt-4 flex justify-between items-center gap-4">
                            <button onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-white font-mono cursor-pointer bg-transparent border-0">
                              &lt;&lt; BACK
                            </button>
                            <button 
                              onClick={() => setStep(3)}
                              disabled={wizardCategories.length === 0}
                              className="outlined-action px-6 py-3 rounded-full text-xs font-bold disabled:opacity-50"
                            >
                              NEXT: REVIEW SUMMARY &gt;&gt;
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Wizard Step 3: Review and Deploy */}
                    {isWizardActive && step === 3 && (
                      <motion.div
                        key="wizard-step-3"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="glass-panel p-8 md:p-12 rounded-[2rem] max-w-3xl w-full mx-auto space-y-8 relative border border-[#E6BE72]/20 shadow-2xl text-left"
                      >
                        {/* Stepper progress indicator */}
                        <div className="w-full flex items-center justify-between border-b border-white/5 pb-6">
                          <div className="flex items-center space-x-3">
                            <span className="text-[9px] text-[#E6BE72] font-mono uppercase tracking-widest font-bold">Capsule Wizard</span>
                            <h2 className="text-xl font-bold text-white">Review Summary</h2>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-[10px] text-gray-400">
                            <span className="text-[#E6BE72] font-bold">3</span> / 4
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="p-4 bg-[#090B14]/40 border border-white/5 rounded-2xl space-y-1 font-mono text-xs">
                            <span className="text-[9px] text-gray-500 uppercase block">Capsule Name</span>
                            <span className="text-white font-extrabold text-sm">{newVaultName}</span>
                          </div>

                          <div className="space-y-3 font-mono">
                            <span className="text-[9px] text-gray-500 uppercase block font-bold tracking-widest">Configured Category Escrows</span>
                            <div className="grid grid-cols-1 gap-3">
                              {wizardCategories.map((c, i) => (
                                <div key={i} className="p-4 bg-[#111827]/60 border border-white/5 rounded-2xl text-xs space-y-2">
                                  <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                    <span className="font-bold text-[#E6BE72] text-sm">{c.category}</span>
                                    <span className="text-[10px] text-gray-500">Inactivity: {c.inactivityPeriod}s | Grace: {c.gracePeriod}s</span>
                                  </div>
                                  <p className="text-[10px] text-gray-400 truncate">Beneficiary: {c.recipient}</p>
                                  {c.fileName && <p className="text-[10px] text-[#2ECC71] font-bold">📄 {c.fileName} ({Math.round(c.content.length / 1024)} KB)</p>}
                                </div>
                              ))}
                            </div>
                          </div>

                          {isEncrypting ? (
                            <div className="p-5 bg-[#111827]/60 border border-white/5 rounded-3xl space-y-3 text-xs font-mono text-[#E6BE72]">
                              <p className="flex items-center space-x-2.5 font-bold">
                                <RefreshCw className="w-4 h-4 animate-spin text-[#E6BE72]" />
                                <span>Local Cryptographic Secret Splitting (2-of-3)...</span>
                              </p>
                              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-gradient-to-r from-[#E6BE72] to-[#7C5CFF] h-1.5 rounded-full animate-[grid-scroll_1.5s_infinite]" style={{ width: '60%' }} />
                              </div>
                              <p className="text-gray-500 text-[10px]">Uploading ciphertext chunks to decentralized IPFS gateway...</p>
                            </div>
                          ) : (
                            <div className="pt-4 flex justify-between items-center gap-4">
                              <button onClick={() => setStep(2)} className="text-xs text-gray-500 hover:text-white font-mono cursor-pointer bg-transparent border-0">
                                &lt;&lt; BACK
                              </button>
                              <button 
                                onClick={handleCreateVault}
                                className="w-full sm:w-auto bg-gradient-to-r from-[#E6BE72] to-[#c5a880] text-gray-950 font-bold px-8 py-3.5 rounded-full text-xs transition-all uppercase tracking-wider cursor-pointer shadow-lg border-0"
                              >
                                ENCRYPT & DEPLOY CAPSULE →
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Wizard Step 4: Receipt */}
                    {isWizardActive && step === 4 && (
                      <motion.div
                        key="wizard-step-4"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="glass-panel p-8 md:p-12 rounded-[2rem] max-w-3xl w-full mx-auto space-y-8 relative border border-[#E6BE72]/20 shadow-2xl text-left"
                      >
                        {/* Stepper progress indicator */}
                        <div className="w-full flex items-center justify-between border-b border-white/5 pb-6">
                          <div className="flex items-center space-x-3">
                            <span className="text-[9px] text-[#E6BE72] font-mono uppercase tracking-widest font-bold">Capsule Wizard</span>
                            <h2 className="text-xl font-bold text-white">Receipt Summary</h2>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-[10px] text-gray-400">
                            <span className="text-[#2ECC71] font-bold">✓</span> Done
                          </div>
                        </div>

                        <div className="text-center p-6 bg-[#2ECC71]/5 border border-[#2ECC71]/10 rounded-3xl space-y-2">
                          <CheckCircle2 className="w-12 h-12 text-[#2ECC71] mx-auto animate-pulse" />
                          <h4 className="font-extrabold text-[#2ECC71] text-sm font-mono uppercase tracking-wider">Capsule Secured Successfully</h4>
                          <p className="text-[11px] text-gray-400 font-mono leading-normal">
                            All payloads are locally AES-256 client-side encrypted and hosted on IPFS. Secret shares are locked in Base Sepolia.
                          </p>
                        </div>

                        <div className="p-4 bg-[#090B14] border border-white/5 rounded-2xl space-y-1 font-mono text-xs">
                          <span className="text-[9px] text-gray-500 uppercase block">Capsule ID (Bytes32 Address)</span>
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-mono text-[#faf6ee] break-all truncate mr-2">{createdVaultId}</span>
                            <button 
                              onClick={() => copyToClipboard(createdVaultId, "vault_id")} 
                              className="p-1 hover:bg-[#E6BE72]/10 text-[#E6BE72] rounded cursor-pointer bg-transparent border-0"
                            >
                              {copiedShare === "vault_id" ? <Check className="w-3.5 h-3.5 text-[#2ECC71]" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3 font-mono">
                          <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Designated Beneficiaries Key Shares (Share 2)</h5>
                          <p className="text-[10px] text-gray-500 leading-relaxed">
                            <span className="text-[#FF5A5F] font-bold">WARNING:</span> Copy the designated Category Share 2 and send it to your respective recipient. Decryption requires both the on-chain share and this private key share.
                          </p>
                          
                          <div className="grid grid-cols-1 gap-3">
                            {createdVaultConfigs.map((cfg, idx) => (
                              <div key={idx} className="p-4 bg-[#111827]/60 border border-white/5 rounded-2xl space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-white">{cfg.category} Share 2</span>
                                  <span className="text-[9px] text-[#E6BE72] bg-[#E6BE72]/10 px-2 py-0.5 rounded border border-[#E6BE72]/20 font-bold">Beneficiary Share</span>
                                </div>
                                <p className="text-[10px] text-gray-400 truncate break-all">{cfg.share2}</p>
                                <button
                                  onClick={() => copyToClipboard(cfg.share2, `s2-${idx}`)}
                                  className="w-full py-2 border border-white/5 hover:border-[#E6BE72]/30 text-[10px] text-gray-400 hover:text-white rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer transition-all bg-transparent"
                                >
                                  {copiedShare === `s2-${idx}` ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-[#2ECC71]" />
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Copy Share 2</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                          <button 
                            onClick={downloadBackupPackage}
                            className="flex-1 bg-gradient-to-r from-[#E6BE72] to-[#c5a880] text-gray-950 font-bold py-3.5 rounded-full text-xs font-mono cursor-pointer uppercase tracking-wider transition-all flex items-center justify-center space-x-2 border-0"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download Backup JSON</span>
                          </button>
                          <button 
                            onClick={resetWizard}
                            className="flex-1 border border-[#E6BE72]/30 hover:border-[#E6BE72] text-[#E6BE72] hover:text-white font-bold py-3.5 rounded-full text-xs font-mono cursor-pointer uppercase tracking-wider transition-all bg-transparent"
                          >
                            Finish & Go to Dashboard
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Tab 2: Recipient Claim Portal */}
                {activeTab === "recipient" && (
                  <motion.div
                    key="recipient-tab-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="glass-panel p-8 md:p-12 rounded-[2rem] max-w-5xl w-full mx-auto space-y-8 text-left"
                  >
                    <div>
                      <span className="text-[10px] text-[#E6BE72] font-mono uppercase tracking-widest font-bold">Decrypt Legacy</span>
                      <h3 className="text-2xl font-bold text-white mt-1">Claim Escrow Portal</h3>
                      <p className="text-xs text-gray-400 mt-1 font-mono">
                        Retrieve the locked contract share and combine it client-side with your recipient share to decrypt files.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Left: Input Form */}
                      <div className="space-y-6">
                        <form onSubmit={handleDecryptVault} className="space-y-4 font-mono text-xs">
                          
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Vault ID</label>
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                placeholder="0x..."
                                value={claimVaultAddress}
                                onChange={(e) => setClaimVaultAddress(e.target.value)}
                                className="flex-1 design-input px-4 py-3 text-xs"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const text = await navigator.clipboard.readText();
                                    setClaimVaultAddress(text.trim());
                                  } catch (err) {
                                    console.error("Failed to read clipboard:", err);
                                  }
                                }}
                                className="px-4 bg-gray-950 border border-gray-900 text-gray-400 hover:text-white rounded-xl text-xs flex items-center justify-center space-x-1 transition-all cursor-pointer border-0"
                                title="Paste Vault ID from clipboard"
                              >
                                <span>Paste</span>
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Your Key Share (Share 2)</label>
                            <div className="flex gap-2 items-start">
                              <textarea 
                                placeholder="Paste the Share 2 hex string here..."
                                value={recipientShareInput}
                                onChange={(e) => setRecipientShareInput(e.target.value)}
                                rows={2}
                                className="flex-1 design-input px-4 py-3 text-xs resize-none"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const text = await navigator.clipboard.readText();
                                    setRecipientShareInput(text.trim());
                                  } catch (err) {
                                    console.error("Failed to read clipboard:", err);
                                  }
                                }}
                                className="px-4 py-3.5 bg-gray-950 border border-gray-900 text-gray-400 hover:text-white rounded-xl text-xs flex items-center justify-center space-x-1 transition-all cursor-pointer self-stretch border-0"
                                title="Paste Share 2 from clipboard"
                              >
                                <span>Paste</span>
                              </button>
                            </div>
                          </div>



                          <button 
                            type="submit"
                            disabled={isDecrypting || !claimVaultAddress || !recipientShareInput}
                            className="w-full bg-gradient-to-r from-[#E6BE72] to-[#c5a880] text-gray-950 font-bold py-3.5 rounded-full text-xs transition-all uppercase tracking-wider cursor-pointer shadow-lg disabled:opacity-50 border-0"
                          >
                            {isDecrypting ? "RUNNING DECRYPTION..." : "Retrieve & Decrypt Legacy →"}
                          </button>
                        </form>

                        {isDecrypting && (
                          <div className="p-4 bg-[#111827]/60 border border-white/5 rounded-2xl space-y-2 text-xs font-mono text-[#E6BE72]">
                            <div className="flex items-center space-x-2">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E6BE72]" />
                              <span className="font-bold">Reconstructing Cryptographic Secret...</span>
                            </div>
                            <div className="text-[10px] text-gray-500 pl-5 space-y-1">
                              <p>✓ Fetching Share 1 from smart contract</p>
                              <p className="animate-pulse">⏳ Combining Share 1 & Share 2 locally</p>
                              <p className="text-gray-600">⌛ Decrypting IPFS payload with recovered key</p>
                            </div>
                          </div>
                        )}

                        {decryptionError && (
                          <div className="p-4 bg-red-500/10 border border-[#FF5A5F]/20 rounded-2xl flex flex-col space-y-2 text-xs text-[#FF5A5F] font-mono">
                            <div className="flex items-start space-x-2.5">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <span className="break-all font-bold">{decryptionError}</span>
                            </div>
                            {decryptionError.includes("Failed to retrieve IPFS payload") && (
                              <p className="text-[10px] text-gray-400 font-normal leading-relaxed mt-1 border-t border-white/5 pt-2">
                                💡 <strong>Why this happens:</strong> If the capsule was deployed while in simulation mode (no Pinata JWT configured in Settings), the encrypted payload was only saved in the creator's browser storage. Because it wasn't published to the actual IPFS network, other browsers cannot retrieve it.
                                <br /><br />
                                <strong>Solution:</strong> Paste your <strong>Pinata JWT Token</strong> in the Settings modal (bottom-left corner), create a new capsule, and try claiming again to test real IPFS synchronization.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Animated Vault Chest / Decrypted Payload Cards */}
                      <div className="flex flex-col justify-center items-center p-6 bg-[#090B14]/40 border border-white/5 rounded-3xl min-h-[350px]">
                        {decryptedItems.length > 0 ? (
                          <div className="w-full space-y-4 font-mono text-left">
                            <div className="flex items-center space-x-2 text-[#2ECC71] text-xs font-bold">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Decryption Success ({decryptedItems.length} categories)</span>
                            </div>

                            {/* Open Glowing Chest SVG */}
                            <svg viewBox="0 0 100 100" className="w-24 h-24 mx-auto text-[#2ECC71] drop-shadow-[0_0_20px_rgba(46,204,113,0.25)]">
                              <polygon points="20,40 50,0 80,40 50,45" fill="url(#chest-glow-grad-portal)" className="animate-pulse" />
                              <rect x="15" y="45" width="70" height="40" rx="8" fill="#111827" stroke="#2ECC71" strokeWidth="2.5" />
                              <path d="M 15 45 C 15 -10, 85 -10, 85 45 Z" fill="#111827" stroke="#2ECC71" strokeWidth="2.5" transform="translate(0, -15) scale(1, 0.6)" />
                              <rect x="44" y="30" width="12" height="15" rx="3" fill="#090B14" stroke="#2ECC71" strokeWidth="2" />
                              <circle cx="50" cy="37" r="2.5" fill="#2ECC71" />
                              <defs>
                                <linearGradient id="chest-glow-grad-portal" x1="50%" y1="0%" x2="50%" y2="100%">
                                  <stop offset="0%" stopColor="#2ECC71" stopOpacity="0.6" />
                                  <stop offset="100%" stopColor="#2ECC71" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                            </svg>

                            <div className="max-h-72 overflow-y-auto space-y-3 pr-1 w-full">
                              {decryptedItems.map((item, idx) => (
                                <div key={idx} className="p-4 bg-[#111827]/70 border border-white/5 rounded-2xl space-y-3">
                                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                    <div>
                                      <span className="text-[9px] text-[#E6BE72] font-bold uppercase block">{item.category} Category</span>
                                      <h5 className="font-bold text-white text-xs">{item.fileName || "Plain memoir text"}</h5>
                                    </div>
                                    {item.fileType && (
                                      <span className="text-[9px] text-[#E6BE72] font-bold font-mono">{item.fileType}</span>
                                    )}
                                  </div>

                                  {item.fileName ? (
                                    <div className="space-y-3">
                                      {item.fileType?.startsWith("image/") ? (
                                        <div className="flex justify-center bg-gray-950/20 p-2 border border-white/5 rounded-2xl">
                                          <img src={item.content} alt="Decrypted media" className="max-w-full max-h-48 rounded-xl object-contain" />
                                        </div>
                                      ) : item.fileType?.startsWith("audio/") ? (
                                        <audio src={item.content} controls className="w-full mt-2" />
                                      ) : (
                                        <div className="p-2 border border-white/5 bg-gray-950/40 rounded-xl text-center">
                                          <FileText className="w-8 h-8 text-gray-600 mx-auto mb-1" />
                                          <span className="text-[10px] text-gray-400">File preview not available.</span>
                                        </div>
                                      )}

                                      <a 
                                        href={item.content} 
                                        download={item.fileName}
                                        className="flex items-center space-x-2 p-2.5 bg-[#E6BE72]/15 text-[#E6BE72] border border-[#E6BE72]/20 rounded-xl hover:bg-[#E6BE72]/25 transition-all font-bold w-full justify-center text-xs cursor-pointer"
                                      >
                                        <Download className="w-4 h-4" />
                                        <span>Download File</span>
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="p-3 bg-[#090B14]/60 border border-white/5 rounded-xl text-xs text-gray-300 break-all whitespace-pre-wrap leading-relaxed">
                                      {item.content}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center space-y-4">
                            {/* Closed Chest SVG */}
                            <svg viewBox="0 0 100 100" className="w-24 h-24 mx-auto text-[#E6BE72] drop-shadow-[0_0_20px_rgba(230,190,114,0.15)]">
                              <rect x="15" y="45" width="70" height="40" rx="8" fill="#111827" stroke="#E6BE72" strokeWidth="2.5" />
                              <path d="M 15 45 C 15 20, 85 20, 85 45 Z" fill="#111827" stroke="#E6BE72" strokeWidth="2.5" />
                              <rect x="44" y="38" width="12" height="15" rx="3" fill="#090B14" stroke="#E6BE72" strokeWidth="2" />
                              <circle cx="50" cy="45" r="2.5" fill="#E6BE72" />
                            </svg>
                            <p className="text-gray-500 font-mono text-[10px]">
                              {isDecrypting ? "Unlocking vault chambers..." : "Enter Vault details to decrypt escrow files."}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Tab 3: Vault Inspector */}
                {activeTab === "inspector" && (
                  <motion.div
                    key="inspector-tab-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="glass-panel p-6 md:p-8 rounded-3xl space-y-6">
                      <div>
                        <span className="text-[10px] text-[#e5c483] font-mono uppercase tracking-widest font-bold">On-Chain State Explorer</span>
                        <h3 className="text-xl font-bold text-white mt-0.5 flex items-center space-x-2">
                          <Search className="w-5 h-5 text-[#e5c483]" />
                          <span>Vault Metadata Inspector</span>
                        </h3>
                        <p className="text-xs text-gray-400 mt-1 font-mono">
                          Query the Base Sepolia blockchain to read the public parameters and dynamic lock status of any digital legacy vault in real-time.
                        </p>
                      </div>

                      <form onSubmit={queryOnChainVault} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Vault ID (66-Character bytes32 Hash)</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="0x..."
                              value={inspectVaultId}
                              onChange={(e) => setInspectVaultId(e.target.value)}
                              className="flex-1 design-input px-4 py-3 text-xs font-mono"
                            />
                            <button 
                              type="submit"
                              disabled={isInspectLoading || !inspectVaultId.trim()}
                              className="px-6 bg-gradient-to-r from-[#e5c483] to-[#c5a880] text-gray-950 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer"
                            >
                              {isInspectLoading ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Eye className="w-4 h-4" />
                                  <span>Query</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </form>

                      {inspectError && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center space-x-2.5 text-xs text-red-400 font-mono">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <span>{inspectError}</span>
                        </div>
                      )}

                      {inspectedVault && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="pt-6 border-t border-white/5 space-y-6 text-left"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Vault Records</h4>
                            <span className="text-[10px] text-gray-500 font-mono">Heirs: {inspectedVault.recipientCount}</span>
                          </div>

                          {/* Split layout: Sub-tabs + Right Timeline */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Panel: Sub-Tabs & Tab Contents */}
                            <div className="lg:col-span-2 space-y-4">
                              {/* Sub-Tabs Nav */}
                              <div className="flex border-b border-white/5 overflow-x-auto pb-1 gap-4 font-mono text-[10px]">
                                {[
                                  { id: "overview", label: "Overview" },
                                  { id: "recipients", label: "Recipients" },
                                  { id: "files", label: "Files" },
                                  { id: "transactions", label: "Transactions" },
                                  { id: "contract", label: "Smart Contract" }
                                ].map((tab) => (
                                  <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setInspectSubTab(tab.id as any)}
                                    className={`pb-2 px-1 font-bold transition-colors cursor-pointer border-b-2 uppercase tracking-wider whitespace-nowrap bg-transparent border-t-0 border-x-0 ${
                                      inspectSubTab === tab.id 
                                        ? "text-[#E6BE72] border-[#E6BE72]" 
                                        : "text-gray-500 border-transparent hover:text-white"
                                    }`}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>

                              {/* Tab Contents */}
                              <div className="space-y-4 pt-2">
                                {inspectSubTab === "overview" && (
                                  <div className="grid grid-cols-1 gap-3 text-[11px] font-mono">
                                    {/* Vault ID */}
                                    <div className="p-3 bg-[#111827]/60 border border-white/5 rounded-xl space-y-1">
                                      <span className="text-[9px] text-gray-500 uppercase block font-bold">Vault ID</span>
                                      <div className="flex justify-between items-center text-gray-300">
                                        <span className="break-all">{inspectedVault.id}</span>
                                        <button 
                                          onClick={() => copyToClipboard(inspectedVault.id, "inspect-v-id")}
                                          className="p-1 text-gray-500 hover:text-[#E6BE72] rounded transition-colors cursor-pointer bg-transparent border-0"
                                          title="Copy Vault ID"
                                        >
                                          {copiedShare === "inspect-v-id" ? (
                                            <Check className="w-3.5 h-3.5 text-[#2ECC71]" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Owner */}
                                    <div className="p-3 bg-[#111827]/60 border border-white/5 rounded-xl space-y-1">
                                      <span className="text-[9px] text-gray-500 uppercase block font-bold">Owner Address</span>
                                      <span className="text-gray-300 break-all">{inspectedVault.owner}</span>
                                    </div>

                                    {/* Last Heartbeat */}
                                    <div className="p-3 bg-[#111827]/60 border border-white/5 rounded-xl space-y-1">
                                      <span className="text-[9px] text-gray-500 uppercase block font-bold">Last Recorded Heartbeat</span>
                                      <div className="flex justify-between items-center text-gray-300">
                                        <span>{new Date(inspectedVault.lastHeartbeat).toLocaleString()}</span>
                                        <span className="text-gray-500 text-[10px]">
                                          {Math.floor((Date.now() - inspectedVault.lastHeartbeat) / 1000)}s elapsed
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {inspectSubTab === "recipients" && (
                                  <div className="space-y-3 font-mono">
                                    {inspectedVault.configs.map((c: any, i: number) => (
                                      <div key={i} className="p-4 bg-[#111827]/60 border border-white/5 rounded-2xl space-y-2 text-xs">
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                          <div>
                                            <span className="font-bold text-[#E6BE72] text-sm">{c.category} Escrow</span>
                                            <p className="text-[9px] text-gray-500">Heir: {c.recipientAddress}</p>
                                          </div>
                                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                                            c.status === "ACTIVE" ? "bg-emerald-500/10 text-[#2ECC71] border border-emerald-500/20" :
                                            c.status === "PENDING_UNLOCK" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse" :
                                            "bg-red-500/10 text-[#FF5A5F] border border-red-500/20"
                                          }`}>
                                            {c.status}
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400 font-mono">
                                          <div>Inactivity: {c.inactivityPeriod}s</div>
                                          <div>Grace Window: {c.gracePeriod}s</div>
                                        </div>

                                        <button
                                          onClick={() => {
                                            setClaimVaultAddress(inspectedVault.id);
                                            setActiveTab("recipient");
                                          }}
                                          className="w-full mt-2 py-2 bg-[#090B14] border border-white/5 text-gray-400 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                        >
                                          Claim Escrow Category →
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {inspectSubTab === "files" && (
                                  <div className="space-y-3 font-mono text-xs text-left">
                                    {inspectedVault.configs.map((c: any, i: number) => (
                                      <div key={i} className="p-4 bg-[#111827]/60 border border-white/5 rounded-xl space-y-2">
                                        <div className="flex justify-between items-center">
                                          <span className="font-bold text-white">{c.category} Ciphertext</span>
                                          <span className="text-[9px] text-gray-500">IPFS Pin</span>
                                        </div>
                                        <div className="text-[10px] bg-[#090B14]/60 p-2 border border-white/5 rounded-lg">
                                          <a 
                                            href={`https://gateway.pinata.cloud/ipfs/${c.ipfsHash.replace("ipfs://", "")}`}
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-[#E6BE72] hover:underline break-all block"
                                          >
                                            {c.ipfsHash} ↗
                                          </a>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {inspectSubTab === "transactions" && (
                                  <div className="space-y-3 font-mono text-[10px]">
                                    {[
                                      { method: "deployVault()", tx: "0x3B5C...D28F", gas: "128,409", status: "success" },
                                      { method: "heartbeat()", tx: "0x8A1E...B409", gas: "45,210", status: "success" },
                                      { method: "getRecipientStatus()", tx: "0x7F2D...C168", gas: "0 (call)", status: "success" }
                                    ].map((tx, idx) => (
                                      <div key={idx} className="p-3 bg-[#111827]/60 border border-white/5 rounded-xl flex justify-between items-center">
                                        <div>
                                          <span className="font-bold text-[#E6BE72] block">{tx.method}</span>
                                          <span className="text-gray-500">Tx: {tx.tx}</span>
                                        </div>
                                        <div className="text-right">
                                          <span className="text-emerald-400 font-bold block">{tx.status}</span>
                                          <span className="text-gray-500">Gas: {tx.gas}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {inspectSubTab === "contract" && (
                                  <div className="p-4 bg-[#111827]/60 border border-white/5 rounded-2xl space-y-3 font-mono text-xs">
                                    <div className="space-y-1">
                                      <span className="text-[9px] text-gray-500 uppercase block font-bold">Contract Address</span>
                                      <span className="text-[#E6BE72] break-all">{contractAddress}</span>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-[9px] text-gray-500 uppercase block font-bold">Base Methods Detected</span>
                                      <p className="text-[10px] text-gray-400">
                                        - `createVault(bytes32, RecipientConfig[])`<br />
                                        - `heartbeat(bytes32)`<br />
                                        - `veto(bytes32)`<br />
                                        - `getRecipientStatus(bytes32, address, string)`
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right Panel: Vertical Timeline */}
                            <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
                              <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono border-b border-white/5 pb-2">Vault Lifecycle</h5>
                              
                              <div className="space-y-5 text-left font-mono text-[10px]">
                                {[
                                  { label: "Vault Created", desc: "Local payload compiled", done: true },
                                  { label: "Encrypted", desc: "AES-256 local key splits ok", done: true },
                                  { label: "Stored on IPFS", desc: "Uploaded decentralized pins", done: true },
                                  { label: "Registered", desc: "Locked smart contract parameters", done: true },
                                  { label: "Heartbeat Sync", desc: "Active reset timer checked", done: true },
                                  { 
                                    label: "Pending Unlock", 
                                    desc: "Grace window countdown", 
                                    done: inspectedVault.configs.some((c: any) => c.status === "PENDING_UNLOCK" || c.status === "UNLOCKED"),
                                    color: inspectedVault.configs.some((c: any) => c.status === "PENDING_UNLOCK") ? "bg-amber-500 animate-pulse" : "bg-[#2ECC71]"
                                  },
                                  { 
                                    label: "Released", 
                                    desc: "Decryption keys downloadable", 
                                    done: inspectedVault.configs.some((c: any) => c.status === "UNLOCKED"),
                                    color: inspectedVault.configs.some((c: any) => c.status === "UNLOCKED") ? "bg-[#2ECC71]" : "bg-white/5 border border-white/5"
                                  }
                                ].map((step, idx) => (
                                  <div key={idx} className="flex gap-3 items-start relative">
                                    <div className={`w-2.5 h-2.5 rounded-full mt-0.5 relative z-10 flex-shrink-0 ${
                                      step.color || (step.done ? "bg-[#2ECC71]" : "bg-white/5 border border-white/5")
                                    }`} />
                                    <div className="space-y-0.5">
                                      <p className={`font-bold leading-normal ${step.done ? "text-white" : "text-gray-500"}`}>{step.label}</p>
                                      <p className="text-gray-500 text-[9px] leading-normal">{step.desc}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Technical Details Cards Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/5">
                            {[
                              { title: "AES-256 Encryption", desc: "Local payload cipher protection", icon: Shield },
                              { title: "Shamir split (2-of-3)", desc: "Threshold secret split recovery", icon: Key },
                              { title: "Pinata IPFS nodes", desc: "Decentralized redundant storage", icon: Upload },
                              { title: "EVM Smart Contract", desc: "Dynamic time-lock execution", icon: Lock }
                            ].map((spec, sIdx) => (
                              <div key={sIdx} className="glass-panel p-4 rounded-xl border border-white/5 space-y-2 cursor-default">
                                <div className="w-7 h-7 rounded-lg bg-[#E6BE72]/10 border border-[#E6BE72]/20 flex items-center justify-center text-[#E6BE72]">
                                  <spec.icon className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <h6 className="text-[10px] font-bold text-white font-mono leading-tight">{spec.title}</h6>
                                  <p className="text-[8px] text-gray-500 leading-normal font-sans">{spec.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Tab 4: Cryptographic Playground */}
                {activeTab === "playground" && (
                  <motion.div
                    key="playground-tab-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-left">
                      {/* Left: Key-Splitting Playground */}
                      <div className="glass-panel p-8 rounded-[2rem] space-y-6">
                        <div>
                          <span className="text-[10px] text-[#E6BE72] font-mono uppercase tracking-widest font-bold">Mathematical Sandbox</span>
                          <h3 className="text-xl font-bold text-white mt-1">Key-Splitting Playground</h3>
                          <p className="text-xs text-gray-400 mt-1 font-mono">
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
                            className="outlined-action w-full py-3.5 rounded-full text-xs font-bold cursor-pointer border-0"
                          >
                            Split Secret into 3 Shares
                          </button>
                        </div>

                        {pgShares.length > 0 && (
                          <div className="space-y-2.5 pt-2">
                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">Generated Shares</h4>
                            {pgShares.map((s, idx) => (
                              <div key={idx} className="p-2.5 bg-gray-950/40 border border-white/5 rounded-xl flex items-center justify-between text-xs gap-3">
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold text-[#E6BE72] font-mono">Share {idx + 1}</span>
                                  <p className="text-[11px] text-gray-400 font-mono truncate">{s}</p>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(s, `pg-${idx}`)}
                                  className="p-1.5 hover:bg-[#E6BE72]/10 text-[#E6BE72] rounded-lg flex-shrink-0 cursor-pointer bg-transparent border-0"
                                >
                                  {copiedShare === `pg-${idx}` ? <Check className="w-3.5 h-3.5 text-[#2ECC71]" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Reconstruct Secret */}
                      <div className="glass-panel p-8 rounded-[2rem] space-y-6">
                        <div>
                          <span className="text-[10px] text-[#E6BE72] font-mono uppercase tracking-widest font-bold">Lagrange Polynomials</span>
                          <h3 className="text-xl font-bold text-white mt-1">Reconstruct Secret</h3>
                          <p className="text-xs text-gray-400 mt-1 font-mono">
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
                            className="outlined-action w-full py-3.5 rounded-full text-xs font-bold cursor-pointer border-0"
                          >
                            Run Lagrange Interpolation
                          </button>
                        </div>

                        {pgDecryptedText && (
                          <div className="p-4 bg-[#2ECC71]/10 border border-[#2ECC71]/20 rounded-xl space-y-1 font-mono">
                            <span className="text-[10px] text-[#2ECC71] uppercase font-bold tracking-wider">Resolved Text</span>
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
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Explore Security Modal Overlay */}
        <AnimatePresence>
          {showSecurityModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-950/80 backdrop-blur-lg flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="glass-panel max-w-2xl w-full rounded-3xl p-6 md:p-8 space-y-6 relative border border-[#e5c483]/30"
              >
                {/* Close Button */}
                <button
                  onClick={() => setShowSecurityModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold cursor-pointer"
                >
                  ✕
                </button>

                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#e5c483] font-bold">Protocol Breakdown</span>
                  <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#faf6ee] font-mono uppercase">
                    LastWish Cryptography
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                  <div className="space-y-2">
                    <h4 className="text-xs font-mono uppercase text-[#e5c483] font-bold">1. Client-Side AES-256-GCM</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Data is encrypted locally in your browser. The decryption keys never touch any server, protecting you from database breaches or system admin access.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-mono uppercase text-[#e5c483] font-bold">2. Shamir's Secret Sharing</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      The encryption key is mathematically split into 3 independent parts. To reconstruct it, 2 of the 3 shares must be combined. Single shards are useless.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-mono uppercase text-[#e5c483] font-bold">3. Smart Contract Heartbeat</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      A decentralized heartbeat ledger on Base Sepolia monitors your vitality. Key reconstruction rights are locked until you fail to check in.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-mono uppercase text-[#e5c483] font-bold">4. Decentralized IPFS Storage</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Your encrypted files are uploaded to IPFS. There is no central point of failure, ensuring your legacy is resilient and retrievable indefinitely.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex justify-end">
                  <button
                    onClick={() => setShowSecurityModal(false)}
                    className="outlined-action px-6 py-2.5 rounded-full text-xs font-bold uppercase transition-all"
                  >
                    Close Specification
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
          {showSettingsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-950/80 backdrop-blur-lg flex items-center justify-center p-4 z-50 font-mono"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="glass-panel max-w-md w-full rounded-3xl p-6 relative border border-[#E6BE72]/30 space-y-4"
              >
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold cursor-pointer bg-transparent border-0"
                >
                  ✕
                </button>
                <h3 className="text-lg font-extrabold text-[#E6BE72] uppercase tracking-wider">Protocol Settings</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Configuration parameters for client encryption modules and RPC nodes:
                </p>
                <div className="space-y-3 text-xs text-gray-300">
                  <div className="p-3 bg-[#090B14]/80 border border-white/5 rounded-xl flex justify-between items-center">
                    <span>Simulator Database</span>
                    <span className="text-[#2ECC71] font-bold">Enabled</span>
                  </div>
                  <div className="p-3 bg-[#090B14]/80 border border-white/5 rounded-xl flex justify-between items-center">
                    <span>Symmetric Algorithm</span>
                    <span className="font-mono text-gray-400">AES-256-GCM</span>
                  </div>
                  <div className="p-3 bg-[#090B14]/80 border border-white/5 rounded-xl flex justify-between items-center">
                    <span>Lagrange Coefficients</span>
                    <span className="font-mono text-gray-400">Prime Finite Field</span>
                  </div>
                </div>

                <div className="space-y-3.5 pt-2 border-t border-white/5 text-left text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-[9px] text-[#E6BE72] uppercase font-bold tracking-wider block">Pinata JWT Token (Real IPFS)</label>
                    <input 
                      type="password"
                      placeholder="Paste your Pinata JWT token..."
                      value={settingsPinataJwt}
                      onChange={(e) => {
                        setSettingsPinataJwt(e.target.value);
                        localStorage.setItem("lastwish_pinata_jwt", e.target.value);
                      }}
                      className="w-full design-input px-3.5 py-2 text-xs bg-gray-950 border border-white/5 text-gray-300 rounded-xl"
                    />
                    <span className="text-[8px] text-gray-500 leading-normal block">Allows deploying capsules directly to the actual decentralized IPFS network.</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-[#E6BE72] uppercase font-bold tracking-wider block">Custom IPFS Gateway URL</label>
                    <input 
                      type="text"
                      placeholder="e.g., https://my-gateway.mypinata.cloud/ipfs/"
                      value={settingsCustomGateway}
                      onChange={(e) => {
                        setSettingsCustomGateway(e.target.value);
                        localStorage.setItem("lastwish_custom_ipfs_gateway", e.target.value);
                      }}
                      className="w-full design-input px-3.5 py-2 text-xs bg-gray-950 border border-white/5 text-gray-300 rounded-xl"
                    />
                    <span className="text-[8px] text-gray-500 leading-normal block">Use your own Pinata dedicated gateway to bypass public CORS rate limits.</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {showHelpModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-950/80 backdrop-blur-lg flex items-center justify-center p-4 z-50 font-mono"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="glass-panel max-w-md w-full rounded-3xl p-6 relative border border-[#E6BE72]/30 space-y-4"
              >
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold cursor-pointer bg-transparent border-0"
                >
                  ✕
                </button>
                <h3 className="text-lg font-extrabold text-[#E6BE72] uppercase tracking-wider">Help & Support</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Need assistance with your digital inheritance setup?
                </p>
                <div className="space-y-2 text-xs text-gray-400">
                  <p>📧 Email: <span className="text-white hover:underline cursor-pointer">support@lastwish.io</span></p>
                  <p>🌐 Discord: <span className="text-white hover:underline cursor-pointer">discord.gg/lastwish</span></p>
                  <p>📖 Whitepaper: <span className="text-white hover:underline cursor-pointer">lastwish.io/docs/spec.pdf</span></p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
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
  </div>
  );
}

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
