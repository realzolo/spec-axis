# Encryption Setup (AES-256-GCM)

This project encrypts integration secrets directly in PostgreSQL using AES-256-GCM. There is no external vault dependency.

## Prerequisites

- Node.js crypto module (built-in)
- `ENCRYPTION_KEY` environment variable (32 bytes = 64 hex characters)

## Setup Steps

### 1. Generate an encryption key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

or:

```bash
openssl rand -hex 32
```

### 2. Add to environment variables

Add the key to your `.env` file:

```bash
ENCRYPTION_KEY=your_generated_key_here
```

**IMPORTANT**:
- Keep this key secret and secure
- Never commit it to version control
- Use different keys for dev/staging/production
- Back up the key securely; if lost, encrypted data cannot be recovered

### 3. Verify setup

Create an integration in **Settings > Integrations** and confirm that:
- The secret is not returned in API responses
- The database field `org_integrations.vault_secret_name` contains an encrypted payload

## How It Works

### Encryption Process

1. Generate random IV (Initialization Vector)
2. Generate random salt
3. Encrypt data using AES-256-GCM with the encryption key
4. Generate authentication tag
5. Store as: `iv:authTag:salt:encrypted`

### Storage

- Encrypted values are stored in `org_integrations.vault_secret_name`
- Decryption happens server-side only via `apps/studio/src/lib/vault.ts`

## Key Rotation

Key rotation is manual in v1:

1. Decrypt all existing secrets with the current key.
2. Set a new `ENCRYPTION_KEY`.
3. Re-encrypt and update `org_integrations.vault_secret_name`.

If the key does not match existing records, decryption will fail.

## Troubleshooting

### Error: "ENCRYPTION_KEY environment variable is not set"

**Solution**: Add `ENCRYPTION_KEY` to your `.env` file and restart the server.

### Error: "ENCRYPTION_KEY must be 64 hex characters"

**Solution**: The key must be exactly 64 hexadecimal characters (32 bytes). Regenerate the key.

### Error: "Invalid encrypted data format"

**Solution**: The encrypted data may be corrupted. Re-enter the secret through the UI.

### Error: "Failed to decrypt secret"

**Solution**:
- Verify the encryption key is correct
- Check if the encrypted data is intact
- Re-enter the secret if necessary

## Security Best Practices

1. **Key Rotation**: Rotate keys periodically (planned maintenance window)
2. **Key Storage**: Use a secure secret manager in production
3. **Access Control**: Limit who can access the encryption key
4. **Monitoring**: Log encryption/decryption failures
5. **Backup**: Securely back up the encryption key

## Performance Notes

AES-256-GCM encryption/decryption is fast (typically ~1ms per secret). The overhead is negligible for normal usage.
