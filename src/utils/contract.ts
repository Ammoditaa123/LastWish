import { BrowserProvider, Contract } from "ethers";

// Default Hardhat localhost address for first deploy, but can be updated or overridden.
export const DEFAULT_CONTRACT_ADDRESS = "0xF5c3Cf856A8603C7adfb4F5114116FB63Ff99181";

export const LAST_WISH_VAULT_ABI = [
  "event VaultCreated(bytes32 indexed vaultId, address indexed owner, uint256 recipientCount)",
  "event HeartbeatUpdated(bytes32 indexed vaultId, uint256 timestamp)",
  "event VetoExecuted(bytes32 indexed vaultId, uint256 timestamp)",
  "event ShareClaimed(bytes32 indexed vaultId, address indexed recipient, string category)",
  "function createVault(bytes32 vaultId, tuple(address recipient, string category, uint256 inactivityPeriod, uint256 gracePeriod, string share1, string ipfsHash)[] calldata configs) external",
  "function heartbeat(bytes32 vaultId) external",
  "function veto(bytes32 vaultId) external",
  "function getVaultDetails(bytes32 vaultId) external view returns (address owner, uint256 lastHeartbeat, uint256 recipientCount)",
  "function getVaultRecipients(bytes32 vaultId) external view returns (tuple(address recipient, string category, uint256 inactivityPeriod, uint256 gracePeriod, string share1, string ipfsHash)[])",
  "function getRecipientStatus(bytes32 vaultId, address recipient, string calldata category) public view returns (uint8)",
  "function claimVaultShare(bytes32 vaultId, string calldata category) external view returns (string)"
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
