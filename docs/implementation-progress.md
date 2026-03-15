# Integration System Implementation Progress

## Current State (v1)

### 1. Database
- `docs/db/init.sql` defines `org_integrations` for org-scoped VCS and AI configurations.
- Organization membership lives in `org_members`; integrations are linked to `organizations` and `auth_users`.
- Default integrations are enforced at the application layer and by schema constraints where applicable.

### 2. Encryption
- Secrets are encrypted using AES-256-GCM in `apps/studio/src/lib/encryption.ts`.
- Encrypted values are stored in `org_integrations.vault_secret_name`.
- The key is provided via `ENCRYPTION_KEY`.

### 3. Integration Service Layer
- `apps/studio/src/services/integrations/types.ts` - Type definitions
- `apps/studio/src/services/integrations/vcs-clients.ts` - VCS client implementations
- `apps/studio/src/services/integrations/ai-clients.ts` - AI client implementations
- `apps/studio/src/services/integrations/factory.ts` - Resolver/factory
- `apps/studio/src/services/integrations/management.ts` - CRUD + default handling

### 4. API Routes
- `/api/integrations` - GET/POST
- `/api/integrations/[id]` - PUT/DELETE
- `/api/integrations/[id]/test` - Connection test
- `/api/integrations/[id]/set-default` - Set default integration
- `/api/integrations/providers` - Provider templates

### 5. Frontend
- Settings > Integrations UI + onboarding checks

### 6. Documentation
- `.env.example` uses `DATABASE_URL` and `ENCRYPTION_KEY`
- `docs/vault-setup.md` describes encryption setup (no external vault)

## Notes

- Supabase has been fully removed. All data access uses PostgreSQL directly.
