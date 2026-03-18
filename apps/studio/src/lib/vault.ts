/**
 * Secret storage using custom encryption
 * All sensitive data is encrypted using AES-256-GCM
 */

import { encrypt, decrypt } from './encryption';

/**
 * Store a secret (encrypt it)
 *
 * @param name - Unique name for the secret (not used)
 * @param secret - The secret value to store
 * @returns The encrypted value
 */
export async function storeSecret(name: string, secret: string): Promise<string> {
  void name;
  return encrypt(secret);
}

/**
 * Read a secret (decrypt it)
 *
 * @param encrypted - The encrypted value
 * @returns The decrypted secret value
 */
export async function readSecret(encrypted: string): Promise<string> {
  try {
    return decrypt(encrypted);
  } catch (error) {
    throw new Error(`Failed to decrypt secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update a secret (re-encrypt it)
 *
 * @param previousEncrypted - The previous encrypted value (not used)
 * @param secret - The new secret value
 * @returns The new encrypted value
 */
export async function updateSecret(previousEncrypted: string, secret: string): Promise<string> {
  void previousEncrypted;
  return encrypt(secret);
}

/**
 * Delete a secret (no-op for custom encryption)
 *
 * @param encrypted - The encrypted value (not used)
 */
export async function deleteSecret(encrypted: string): Promise<void> {
  void encrypted;
  // No action needed - encrypted value is stored in database
  // and will be deleted when the integration is deleted
}

/**
 * Generate a unique identifier for a user integration
 *
 * @param userId - The user ID
 * @param type - Integration type (vcs or ai)
 * @param integrationId - The integration ID
 * @returns A unique identifier
 */
export function generateSecretName(userId: string, type: 'vcs' | 'ai', integrationId: string): string {
  return `user_${userId}_${type}_${integrationId}`;
}
