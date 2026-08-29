/**
 * Calculate Shannon Entropy of a string.
 * Higher entropy indicates greater randomness (e.g. API keys, cryptographic tokens, passwords).
 */
export function calculateShannonEntropy(str: string): number {
  if (!str || str.length === 0) return 0;

  const frequencies: Record<string, number> = {};
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    frequencies[char] = (frequencies[char] || 0) + 1;
  }

  let entropy = 0;
  const len = str.length;
  for (const char in frequencies) {
    const p = frequencies[char] / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Checks if a string has high entropy typical of API keys or secrets.
 * - Minimum length: usually >= 16 characters
 * - Entropy threshold: typically >= 3.8 - 4.2 for alphanumeric/base64 strings
 */
export function isHighEntropyString(str: string, minLength = 16, threshold = 3.9): boolean {
  if (!str || str.length < minLength) return false;

  // Ignore common placeholder / url / test patterns
  if (
    /^(https?:\/\/|Bearer\s|Bearer$|mongodb(\+srv)?:\/\/|postgres:\/\/|mysql:\/\/|localhost|127\.0\.0\.1)/i.test(
      str
    )
  ) {
    // If it's a connection string with embedded password, that's handled by regex
    if (!/:\/\/.*?:.*?@/.test(str)) {
      return false;
    }
  }

  // Ignore words with spaces, hyphens only, or common variable names
  if (/\s/.test(str)) return false;
  if (/^[a-zA-Z0-9_\-\.]+$/.test(str)) {
    const entropy = calculateShannonEntropy(str);
    return entropy >= threshold;
  }

  return false;
}
