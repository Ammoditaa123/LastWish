import { BrowserProvider, Contract } from "ethers";

// Default Hardhat localhost address for first deploy, but can be updated or overridden.
export const DEFAULT_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const LAST_WISH_VAULT_ABI = [
  "event VaultCreated(bytes32 indexed vaultId, address indexed owner, address indexed recipient, uint256 inactivityPeriod, uint256 gracePeriod)",
  "event HeartbeatUpdated(bytes32 indexed vaultId, uint256 timestamp)",
  "event VetoExecuted(bytes32 indexed vaultId, uint256 timestamp)",
  "event ShareClaimed(bytes32 indexed vaultId, address indexed recipient)",
  "function createVault(bytes32 vaultId, address recipient, uint256 inactivityPeriod, uint256 gracePeriod, string calldata share1, string calldata ipfsHash) external",
  "function heartbeat(bytes32 vaultId) external",
  "function veto(bytes32 vaultId) external",
  "function getVaultStatus(bytes32 vaultId) public view returns (uint8)",
  "function getVaultDetails(bytes32 vaultId) external view returns (address owner, address recipient, uint256 inactivityPeriod, uint256 gracePeriod, uint256 lastHeartbeat, string ipfsHash, uint8 status)",
  "function claimVaultShare(bytes32 vaultId) external view returns (string)"
];

/**
 * Returns a read-only Provider or a Signer-enabled Provider.
 */
export async function getEthereumProvider() {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("No Ethereum provider found. Please install MetaMask.");
  }
  return new BrowserProvider((window as any).ethereum);
}

/**
 * Returns the contract instance connected to a signer.
 */
export async function getVaultContract(contractAddress?: string) {
  const provider = await getEthereumProvider();
  const signer = await provider.getSigner();
  const address = contractAddress || localStorage.getItem("lastwish_contract_address") || DEFAULT_CONTRACT_ADDRESS;
  return new Contract(address, LAST_WISH_VAULT_ABI, signer);
}
