import { EncryptedPayload } from "./crypto";

// Pinata JWT token for client-side uploads. Can be configured in Next.js environment variables.
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT || "";

/**
 * Uploads client-side encrypted JSON payloads to IPFS via Pinata.
 * Falls back to local storage simulation if no Pinata keys are set.
 */
export async function uploadToIPFS(payload: EncryptedPayload, vaultName: string = "Vault"): Promise<string> {
  const jwt = PINATA_JWT || localStorage.getItem("lastwish_pinata_jwt") || "";

  if (!jwt) {
    console.warn("Pinata JWT not found in env or localStorage. Simulating IPFS upload.");
    
    // Generate a random mock IPFS CID (SHA-256 base58 multi-hash style)
    const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const mockCid = "Qm" + Array.from({ length: 44 }, () => 
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
    
    // Store mock payload locally so downloadFromIPFS can fetch it using the same CID
    localStorage.setItem(`ipfs_sim_${mockCid}`, JSON.stringify(payload));
    return mockCid;
  }

  try {
    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        pinataContent: payload,
        pinataMetadata: {
          name: `LastWish-${vaultName}-${Date.now()}`,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata upload HTTP error: ${response.status}. ${errorText}`);
    }

    const data = await response.json();
    return data.IpfsHash; // Pinata returns the IPFS CID
  } catch (err: any) {
    console.error("IPFS Pinata upload failed:", err);
    throw new Error(`Pinata upload failed: ${err.message}`);
  }
}

/**
 * Downloads client-side encrypted JSON payloads from IPFS using public gateways.
 * Falls back to local simulation if the simulated CID is detected.
 */
export async function downloadFromIPFS(cid: string): Promise<EncryptedPayload> {
  // If simulated CID exists in localStorage, return it
  const simulated = localStorage.getItem(`ipfs_sim_${cid}`);
  if (simulated) {
    return JSON.parse(simulated);
  }

  // Remove custom prefixes (e.g. "ipfs://")
  const cleanCid = cid.replace("ipfs://", "").trim();

  // Try multiple gateways for redundancy
  const gateways: string[] = [];

  // Check if user has configured a custom gateway in Settings
  if (typeof window !== "undefined") {
    const customGateway = localStorage.getItem("lastwish_custom_ipfs_gateway") || "";
    if (customGateway) {
      const base = customGateway.endsWith("/") ? customGateway : `${customGateway}/`;
      gateways.push(`${base}${cleanCid}`);
    }
  }

  // Fallback public gateways
  gateways.push(
    `https://ipfs.io/ipfs/${cleanCid}`,
    `https://cloudflare-ipfs.com/ipfs/${cleanCid}`,
    `https://gateway.pinata.cloud/ipfs/${cleanCid}`,
    `https://dweb.link/ipfs/${cleanCid}`,
    `https://w3s.link/ipfs/${cleanCid}`,
    `https://ipfs.fleek.co/ipfs/${cleanCid}`,
    `https://crustipfs.xyz/ipfs/${cleanCid}`,
    `https://gw.crustfiles.app/ipfs/${cleanCid}`,
    `https://trustless-gateway.link/ipfs/${cleanCid}`
  );

  let lastError = null;
  for (const url of gateways) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000); // 6s timeout per gateway

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(id);

      if (response.ok) {
        return await response.json();
      }
    } catch (e: any) {
      console.warn(`IPFS gateway fetch failed for ${url}:`, e.message || e);
      lastError = e;
    }
  }

  throw new Error(`Failed to retrieve IPFS payload for CID: ${cid}. Last error: ${lastError?.message || "All gateways timed out"}`);
}
