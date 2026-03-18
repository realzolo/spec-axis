# Integration System - Implementation Summary (v1)

## Core Principles

1. **UI-only configuration**: No environment-variable based VCS/AI setup.
2. **Org-scoped isolation**: Integrations belong to organizations.
3. **Secure storage**: Secrets are encrypted with AES-256-GCM.
4. **Mandatory onboarding**: New users must configure integrations.

## Database

All schema lives in `docs/db/init.sql`.

### `org_integrations`
```
- id: UUID
- user_id: UUID (creator)
- org_id: UUID
- type: 'vcs' | 'ai'
- provider: 'github' | 'gitlab' | 'git' | 'openai-api'
- name: TEXT
- is_default: BOOLEAN
- config: JSONB (non-sensitive)
- vault_secret_name: TEXT (encrypted secret payload)
- created_at / updated_at
```

### Project Integration Binding

`code_projects` stores:
- `vcs_integration_id`
- `ai_integration_id`

## Encryption

Secrets are encrypted and decrypted in the app:
- `apps/studio/src/lib/encryption.ts`
- `apps/studio/src/lib/vault.ts`

Key: `ENCRYPTION_KEY` (64 hex chars).

## Service Layer

`apps/studio/src/services/integrations/` provides:
- Types
- VCS clients
- AI clients
- Factory and resolver
- Management CRUD

## API Layer

- `/api/integrations` (GET/POST)
- `/api/integrations/[id]` (PUT/DELETE)
- `/api/integrations/[id]/test`
- `/api/integrations/[id]/set-default`
- `/api/integrations/providers`

## Configuration Priority

```
Project-specific integration > Org default integration > Error
```

## Notes

- Supabase has been fully removed.
- Access control is enforced in application code (no RLS dependency).
