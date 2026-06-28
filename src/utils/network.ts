/**
 * Network configuration for Base Sepolia Testnet.
 * All contract interactions must use this chain.
 */

export const BASE_SEPOLIA = {
  chainId: 84532,
  chainIdHex: "0x14A34",
  name: "Base Sepolia",
  currency: "ETH",
  rpcUrl: "https://sepolia.base.org",
  blockExplorer: "https://sepolia.basescan.org",
} as const;

/**
 * Returns true if the user's MetaMask is currently on Base Sepolia.
 */
export function isBaseSepolia(chainId: string | number): boolean {
  const id = typeof chainId === "string"
    ? parseInt(chainId, chainId.startsWith("0x") ? 16 : 10)
    : chainId;
  return id === BASE_SEPOLIA.chainId;
}

/**
 * Prompts MetaMask to switch to Base Sepolia.
 * If the chain is not in the wallet, adds it first.
 * Throws if the user rejects or another error occurs.
 */
export async function switchToBaseSepolia(): Promise<void> {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("MetaMask not found.");

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_SEPOLIA.chainIdHex }],
    });
  } catch (switchError: any) {
    // Error code 4902 = chain not added to MetaMask yet
    if (switchError?.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BASE_SEPOLIA.chainIdHex,
            chainName: BASE_SEPOLIA.name,
            nativeCurrency: {
              name: "Ethereum",
              symbol: BASE_SEPOLIA.currency,
              decimals: 18,
            },
            rpcUrls: [BASE_SEPOLIA.rpcUrl],
            blockExplorerUrls: [BASE_SEPOLIA.blockExplorer],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

/**
 * Ensures the wallet is on Base Sepolia before a transaction.
 * Call this before any write contract interaction.
 */
export async function ensureBaseSepolia(): Promise<void> {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("MetaMask not found.");

  const chainId = await eth.request({ method: "eth_chainId" });
  if (!isBaseSepolia(chainId)) {
    await switchToBaseSepolia();
    // Re-verify after switch
    const newChainId = await eth.request({ method: "eth_chainId" });
    if (!isBaseSepolia(newChainId)) {
      throw new Error("Please switch to Base Sepolia to continue.");
    }
  }
}
