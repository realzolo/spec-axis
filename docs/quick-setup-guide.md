# Quick Setup Guide

This guide will help you set up the integration system in 5 minutes.

## Prerequisites

- Supabase project
- Node.js environment
- Access to Supabase SQL Editor

## Step 1: Generate Encryption Key (1 minute)

Run this command to generate a secure encryption key:

```bash
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

Or use OpenSSL:

```bash
openssl rand -hex 32
```

Copy the output (64 hex characters).

## Step 2: Update Environment Variables (1 minute)

Add to your `.env` file:

```bash
# Existing Supabase variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# New: Encryption key
ENCRYPTION_KEY=paste_your_generated_key_here
```

**IMPORTANT**: Keep this key secret and back it up!

## Step 3: Run Database Migration (2 minutes)

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Create a new query
4. Copy and paste the contents of `supabase/migrations/006_user_integrations.sql`
5. Click "Run"

Wait for the migration to complete (should take ~10 seconds).

## Step 4: Restart Your Application (1 minute)

```bash
# Stop your dev server (Ctrl+C)
# Start it again
pnpm dev
```

## Step 5: Test the Setup (1 minute)

1. Open your application in browser
2. Register a new user or login
3. You should see an onboarding modal
4. Click "Configure Integrations"
5. Try adding a VCS integration (GitHub)
6. Try adding an AI integration (Anthropic)

## Verification Checklist

- [ ] Encryption key generated and added to `.env`
- [ ] Database migration executed successfully
- [ ] Application restarted
- [ ] Onboarding modal appears for new users
- [ ] Can create VCS integration
- [ ] Can create AI integration
- [ ] Can test connections
- [ ] Can set default integrations

## Troubleshooting

### Error: "ENCRYPTION_KEY environment variable is not set"

**Solution**: Make sure you added `ENCRYPTION_KEY` to your `.env` file and restarted the application.

### Error: "relation user_integrations does not exist"

**Solution**: The database migration didn't run. Go back to Step 3.

### Error: "Failed to store secret"

**Solution**: Check that your encryption key is exactly 64 hex characters.

### Onboarding modal doesn't appear

**Solution**:
1. Clear browser cache
2. Try in incognito mode
3. Check browser console for errors

## Next Steps

After setup is complete:

1. **Configure Your First Integration**
   - Go to Settings > Integrations
   - Add a GitHub integration with your PAT
   - Add an Anthropic integration with your API key

2. **Create Your First Project**
   - Go to Projects
   - Click "Add Project"
   - Select a repository
   - Start analyzing code

3. **Explore Features**
   - Try different AI models
   - Configure project-specific integrations
   - Set up custom rule sets

## Security Reminders

- ✅ Keep `ENCRYPTION_KEY` secret
- ✅ Never commit `.env` to version control
- ✅ Back up your encryption key securely
- ✅ Use different keys for dev/staging/production
- ✅ Rotate keys periodically

## Getting Help

If you encounter issues:

1. Check the [Integration System Implementation](./integration-system-implementation.md) guide
2. Review the [API Reference](./api-reference.md)
3. Check the [Custom Encryption Setup](./custom-encryption-setup.md) guide
4. Look at browser console for error messages
5. Check Supabase logs for database errors

## Production Deployment

Before deploying to production:

1. Generate a new encryption key (don't reuse dev key)
2. Set `ENCRYPTION_KEY` in your production environment
3. Run database migration on production database
4. Test thoroughly in staging first
5. Have a rollback plan ready

## Estimated Time

- **Total Setup Time**: ~5 minutes
- **First Integration**: ~2 minutes
- **First Project**: ~3 minutes
- **Total to First Analysis**: ~10 minutes

You're all set! 🎉
