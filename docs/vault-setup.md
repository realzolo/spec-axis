# Enabling Supabase Vault

## Prerequisites

- Supabase project (Pro plan or higher recommended)
- Database access via SQL Editor

## Steps to Enable Vault

### 1. Enable the Vault Extension

Run the following SQL in your Supabase SQL Editor:

```sql
-- Enable the vault extension
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
```

### 2. Verify Installation

Check if the vault functions are available:

```sql
-- List vault functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'vault'
AND routine_type = 'FUNCTION';
```

You should see functions like:
- `create_secret`
- `read_secret`
- `update_secret`
- `delete_secret`

### 3. Grant Permissions

Ensure the service role has access to vault functions:

```sql
-- Grant usage on vault schema
GRANT USAGE ON SCHEMA vault TO service_role;

-- Grant execute on vault functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA vault TO service_role;
```

### 4. Test Vault

Test creating and reading a secret:

```sql
-- Create a test secret
SELECT vault.create_secret('test_secret_name', 'test_secret_value');

-- Read the secret
SELECT decrypted_secret
FROM vault.decrypted_secrets
WHERE name = 'test_secret_name';

-- Clean up
SELECT vault.delete_secret('test_secret_name');
```

## Troubleshooting

### Error: "extension supabase_vault does not exist"

**Solution**: Vault extension may not be available in your Supabase version. Options:
1. Upgrade to a newer Supabase version
2. Use the alternative encryption method (see below)

### Error: "permission denied for schema vault"

**Solution**: Run the grant permissions SQL above.

### Error: "Could not find the function"

**Solution**:
1. Verify extension is installed: `SELECT * FROM pg_extension WHERE extname = 'supabase_vault';`
2. Check if functions exist in vault schema
3. Restart your application to clear any cached connections

## Alternative: Custom Encryption

If Vault is not available, you can use custom encryption instead. See [custom-encryption-setup.md](./custom-encryption-setup.md) for details.

## References

- [Supabase Vault Documentation](https://supabase.com/docs/guides/database/vault)
- [PostgreSQL Extensions](https://supabase.com/docs/guides/database/extensions)
