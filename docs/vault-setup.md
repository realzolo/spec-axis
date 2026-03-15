# Encryption Setup

This project stores integration secrets encrypted in PostgreSQL using AES-256-GCM. There is no external vault dependency.

## Required Environment Variable

- `ENCRYPTION_KEY` (required): 32-byte hex key (64 hex characters)

Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

or:

```bash
openssl rand -hex 32
```

## How It Works

- Secrets are encrypted in `apps/studio/src/lib/encryption.ts`.
- Encrypted values are stored in `org_integrations.vault_secret_name`.
- Decryption happens at runtime via `apps/studio/src/lib/vault.ts`.

## Key Rotation

Key rotation is not automated in v1. Plan a maintenance window to:

1. Read and decrypt all existing secrets with the current key.
2. Set the new `ENCRYPTION_KEY`.
3. Re-encrypt and update the stored secrets.

If the key does not match existing records, decryption will fail.
