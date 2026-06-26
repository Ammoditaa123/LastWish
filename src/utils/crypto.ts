import { splitSecret, reconstructSecret, encodeShare, decodeShare } from "./shamir";

/**
 * Interface representing the encrypted payload containing the IV and the ciphertext
 */
export interface EncryptedPayload {
  iv: string;   // Base64 encoded Initialization Vector (12 bytes)
  data: string; // Base64 encoded ciphertext
}

/**
 * Converts a Uint8Array to a Base64 string
 */
function uint8ToBase64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr));
}

/**
 * Converts a Base64 string to a Uint8Array
 */
function base64ToUint8(str: string): Uint8Array {
  const binaryStr = atob(str);
  const arr = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    arr[i] = binaryStr.charCodeAt(i);
  }
  return arr;
}

/**
 * Encrypts a text string or file data using client-side AES-256-GCM.
 * Generates a random key, encrypts the payload, and splits the key into 3 shares (threshold 2).
 * Returns the encrypted payload, and the 3 key shares as formatted strings.
 */
export async function encryptAndSplit(
  plainText: string,
  threshold = 2,
  totalShares = 3
): Promise<{
  payload: EncryptedPayload;
  shares: string[];
}> {
  const encoder = new TextEncoder();
  const dataToEncrypt = encoder.encode(plainText);

  // 1. Generate a random AES-256-GCM key
  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );

  // 2. Generate a random 12-byte IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt the data
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
    },
    key,
    dataToEncrypt as BufferSource
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);

  // 4. Export the raw key (32 bytes)
  const rawKeyBuffer = await window.crypto.subtle.exportKey("raw", key);
  const rawKey = new Uint8Array(rawKeyBuffer);

  // 5. Split the raw key using Shamir's Secret Sharing
  const rawShares = splitSecret(rawKey, threshold, totalShares);
  const encodedShares = rawShares.map(s => encodeShare(s.index, s.data));

  return {
    payload: {
      iv: uint8ToBase64(iv),
      data: uint8ToBase64(ciphertext),
    },
    shares: encodedShares,
  };
}

/**
 * Reconstructs the AES key from at least 2 shares and decrypts the encrypted payload.
 * Returns the decrypted plain text.
 */
export async function reconstructAndDecrypt(
  payload: EncryptedPayload,
  shareStrings: string[]
): Promise<string> {
  // 1. Decode the share strings
  const decodedShares = shareStrings.map(s => decodeShare(s));

  // 2. Reconstruct the raw key bytes (32 bytes)
  const rawKey = reconstructSecret(decodedShares);

  // 3. Import the key back into Web Crypto
  const key = await window.crypto.subtle.importKey(
    "raw",
    rawKey as BufferSource,
    { name: "AES-GCM" },
    false, // not extractable
    ["decrypt"]
  );

  // 4. Decode base64 IV and ciphertext
  const iv = base64ToUint8(payload.iv);
  const ciphertext = base64ToUint8(payload.data);

  // 5. Decrypt the data
  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as BufferSource,
      },
      key,
      ciphertext as BufferSource
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    throw new Error("Decryption failed. Check key shares for corruption or mismatched inputs.");
  }
}
