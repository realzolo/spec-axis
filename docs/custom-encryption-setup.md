# Custom Encryption Setup

If Supabase Vault is not available in your instance, the system will automatically fall back to custom encryption using AES-256-GCM.

## Prerequisites

- Node.js crypto module (built-in)
- Environment variable for encryption key

## Setup Steps

### 1. Generate Encryption Key

Run the following command to generate a secure encryption key:

```bash
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

Or use OpenSSL:

```bash
openssl rand -hex 32
```

This will output something like:
```
ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### 2. Add to Environment Variables

Add the generated key to your `.env` file:

```bash
# Encryption key for sensitive data (32 bytes = 64 hex characters)
ENCRYPTION_KEY=your_generated_key_here
```

**IMPORTANT**:
- Keep this key secret and secure
- Never commit it to version control
- Use different keys for different environments (dev, staging, production)
- Back up this key securely - if lost, encrypted data cannot be recovered

### 3. Verify Setup

The system will automatically detect if Vault is unavailable and use custom encryption. You can verify by checking the logs when creating an integration:

```
Supabase Vault is not available. Falling back to custom encryption.
```

## How It Works

### Encryption Process

1. Generate random IV (Initialization Vector)
2. Generate random salt
3. Encrypt data using AES-256-GCM with the encryption key
4. Generate authentication tag
5. Store as: `iv:authTag:salt:encrypted`

### Storage

When using custom encryption:
- The encrypted value is stored directly in the `vault_secret_name` field
- No separate Vault storage is used
- Each secret has its own random IV and salt

### Security Features

- **AES-256-GCM**: Industry-standard authenticated encryption
- **Random IV**: Each encryption uses a unique IV
- **Authentication Tag**: Prevents tampering
- **Salt**: Additional randomness for each secret

## Migration from Vault to Custom Encryption

If you need to migrate from Vault to custom encryption:

1. Export all secrets from Vault
2. Re-encrypt using custom encryption
3. Update `vault_secret_name` fields with new encrypted values

**Note**: This is a one-way migration. Migrating back to Vault requires re-entering all secrets.

## Migration from Custom Encryption to Vault

If Vault becomes available later:

1. Enable Vault extension (see [vault-setup.md](./vault-setup.md))
2. Decrypt all secrets using custom encryption
3. Store in Vault using proper secret names
4. Update `vault_secret_name` fields with Vault secret names

## Troubleshooting

### Error: "ENCRYPTION_KEY environment variable is not set"

**Solution**: Add `ENCRYPTION_KEY` to your `.env` file (see step 2 above)

### Error: "ENCRYPTION_KEY must be 64 hex characters"

**Solution**: The key must be exactly 64 hexadecimal characters (32 bytes). Regenerate using the command in step 1.

### Error: "Invalid encrypted data format"

**Solution**: The encrypted data may be corrupted. This can happen if:
- The encryption key was changed
- The data was manually modified
- The data format is incorrect

You'll need to re-enter the secret through the UI.

### Error: "Failed to decrypt secret"

**Solution**:
- Verify the encryption key is correct
- Check if the encrypted data is intact
- Re-enter the secret if necessary

## Security Best Practices

1. **Key Rotation**: Periodically rotate encryption keys
2. **Key Storage**: Use a secure key management system in production
3. **Access Control**: Limit who can access the encryption key
4. **Monitoring**: Log encryption/decryption operations
5. **Backup**: Securely back up the encryption key

## Performance Considerations

Custom encryption is slightly slower than Vault but still very fast:
- Encryption: ~1ms per secret
- Decryption: ~1ms per secret

For most use cases, this performance difference is negligible.

## Comparison: Vault vs Custom Encryption

| Feature | Vault | Custom Encryption |
|---------|-------|-------------------|
| Setup | Requires extension | Just environment variable |
| Performance | Faster | Slightly slower |
| Key Management | Automatic | Manual |
| Audit Logs | Built-in | Need to implement |
| Key Rotation | Supported | Manual process |
| Cost | May require Pro plan | Free |

## References

- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
- [AES-GCM Encryption](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
- [NIST Encryption Standards](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines)
