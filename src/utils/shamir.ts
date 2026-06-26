/**
 * Shamir's Secret Sharing (SSS) over GF(2^8)
 * 
 * This is a pure-TypeScript, zero-dependency implementation of Shamir's
 * Secret Sharing using polynomial interpolation over Galois Field 256.
 */

const PRIMITIVE = 0x11d; // x^8 + x^4 + x^3 + x^2 + 1
const exp = new Uint8Array(512);
const log = new Uint8Array(256);

// Initialize exp and log tables for GF(2^8) multiplication/division
let x = 1;
for (let i = 0; i < 255; i++) {
  exp[i] = x;
  log[x] = i;
  x <<= 1;
  if (x & 0x100) {
    x ^= PRIMITIVE;
  }
}
for (let i = 255; i < 512; i++) {
  exp[i] = exp[i - 255];
}

/**
 * Multiply two numbers in GF(2^8)
 */
function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return exp[log[a] + log[b]];
}

/**
 * Divide two numbers in GF(2^8)
 */
function div(a: number, b: number): number {
  if (b === 0) throw new Error("Division by zero in GF(2^8)");
  if (a === 0) return 0;
  let diff = log[a] - log[b];
  if (diff < 0) diff += 255;
  return exp[diff];
}

/**
 * Split a secret Uint8Array into N shares, requiring a threshold T to reconstruct.
 * Each share is formatted as: { index: number, data: Uint8Array }
 */
export function splitSecret(secret: Uint8Array, threshold: number, totalShares: number): Array<{ index: number; data: Uint8Array }> {
  if (threshold < 2 || threshold > totalShares) {
    throw new Error("Invalid threshold. Must be >= 2 and <= totalShares.");
  }
  if (totalShares > 255) {
    throw new Error("Total shares cannot exceed 255.");
  }

  const shares = Array.from({ length: totalShares }, (_, i) => ({
    index: i + 1,
    data: new Uint8Array(secret.length),
  }));

  const randomCoeffs = new Uint8Array(threshold);

  // For each byte of the secret
  for (let i = 0; i < secret.length; i++) {
    // a_0 is the secret byte
    randomCoeffs[0] = secret[i];
    
    // Fill other coefficients with random non-zero bytes
    for (let j = 1; j < threshold; j++) {
      randomCoeffs[j] = Math.floor(Math.random() * 255) + 1;
    }

    // Evaluate polynomial for each share index x = 1...N
    for (let s = 0; s < totalShares; s++) {
      const xVal = shares[s].index;
      let yVal = 0;
      // Evaluate using Horner's method
      for (let c = threshold - 1; c >= 0; c--) {
        yVal = mul(yVal, xVal) ^ randomCoeffs[c];
      }
      shares[s].data[i] = yVal;
    }
  }

  return shares;
}

/**
 * Reconstruct the secret from a set of threshold shares.
 * Assumes shares are an array of { index: number, data: Uint8Array }
 */
export function reconstructSecret(shares: Array<{ index: number; data: Uint8Array }>): Uint8Array {
  if (shares.length < 2) {
    throw new Error("At least 2 shares are required to reconstruct.");
  }

  const secretLength = shares[0].data.length;
  const secret = new Uint8Array(secretLength);
  const T = shares.length;

  const xVals = shares.map(s => s.index);

  // For each byte position
  for (let i = 0; i < secretLength; i++) {
    let sum = 0;

    for (let k = 0; k < T; k++) {
      let weight = 1;

      for (let j = 0; j < T; j++) {
        if (j === k) continue;
        // Lagrange basis polynomial evaluation at x = 0
        const num = xVals[j];
        const den = xVals[j] ^ xVals[k]; // GF(2^8) subtraction is XOR
        weight = mul(weight, div(num, den));
      }

      const term = mul(shares[k].data[i], weight);
      sum ^= term; // GF(2^8) addition is XOR
    }

    secret[i] = sum;
  }

  return secret;
}

/**
 * Helper to encode a share into a single hex string: "index-hexdata"
 */
export function encodeShare(index: number, data: Uint8Array): string {
  const hexData = Array.from(data)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return `${index}-${hexData}`;
}

/**
 * Helper to decode a hex share string back into index and Uint8Array
 */
export function decodeShare(shareString: string): { index: number; data: Uint8Array } {
  const parts = shareString.trim().split("-");
  if (parts.length !== 2) {
    throw new Error("Invalid share string format. Expected 'index-hexdata'.");
  }

  const index = parseInt(parts[0], 10);
  if (isNaN(index) || index <= 0) {
    throw new Error("Invalid share index.");
  }

  const hexData = parts[1];
  if (hexData.length % 2 !== 0) {
    throw new Error("Invalid hex share data length.");
  }

  const data = new Uint8Array(hexData.length / 2);
  for (let i = 0; i < data.length; i++) {
    data[i] = parseInt(hexData.substring(i * 2, i * 2 + 2), 16);
  }

  return { index, data };
}
