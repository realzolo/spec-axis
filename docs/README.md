# Integration System Documentation

This directory contains documentation for the Integration System implementation.

## Documents

### [Quick Setup Guide](./quick-setup-guide.md) ⭐ START HERE
5-minute guide to get the integration system up and running:
- Generate encryption key
- Update environment variables
- Initialize database schema
- Test the setup

### [Integration System Implementation](./integration-system-implementation.md)
Complete implementation summary including:
- Core principles
- Completed work
- Remaining tasks
- Design decisions
- Quick start guide
- Architecture overview
- Security considerations
- Testing checklist

### [Implementation Progress](./implementation-progress.md)
Detailed progress tracking of the implementation:
- Completed components
- Remaining work
- Design decisions
- Next steps

### [API Reference](./api-reference.md)
Complete API documentation for integration endpoints:
- Endpoint specifications
- Request/response formats
- Usage examples
- Error handling
- Security considerations

### [Encryption Setup](./custom-encryption-setup.md)
Detailed guide for the encryption system:
- How encryption works
- Security features
- Key management
- Troubleshooting
- Best practices

## Quick Links

- **Main Documentation**: [CLAUDE.md](../CLAUDE.md) - Project guide and technical specifications
- **Database Init Script**: [init.sql](./db/init.sql)
- **Integration Service**: [apps/studio/src/services/integrations/](../apps/studio/src/services/integrations/)

## Overview

The Integration System allows users to configure VCS (Version Control System) and AI model integrations through the web UI, completely removing the need for environment variables.

### Key Features

- **Multi-Provider Support**: GitHub, GitLab, Anthropic, OpenAI, and more
- **Secure Storage**: Sensitive data encrypted using AES-256-GCM
- **Multi-Tenant**: Complete isolation between organizations
- **Flexible Configuration**: Project-level and org-level defaults
- **First-Time Onboarding**: Guided setup for new users

### Architecture

```
User Interface (Settings > Integrations)
    ↓
API Layer (/api/integrations)
    ↓
Service Layer (src/services/integrations)
    ↓
Database (org_integrations table + Encrypted secrets)
```

### Configuration Priority

```
Project-specific integration > Org default integration > Error (must configure)
```

## Getting Started

1. **Quick Setup**: Read [Quick Setup Guide](./quick-setup-guide.md) (5 minutes)
2. **For Developers**: Read [Integration System Implementation](./integration-system-implementation.md)
3. **For API Usage**: Read [API Reference](./api-reference.md)
4. **For Security Details**: Read [Custom Encryption Setup](./custom-encryption-setup.md)

## Support

For questions or issues, please refer to the main project documentation in [CLAUDE.md](../CLAUDE.md).
