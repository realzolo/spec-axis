function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireAbsoluteUrl(name: string, value: string, mustUseHttps: boolean) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }

  if (mustUseHttps && parsed.protocol !== 'https:') {
    throw new Error(`${name} must use https in production`);
  }
}

function validateProductionEnv() {
  requiredEnv('DATABASE_URL');
  requiredEnv('ENCRYPTION_KEY');
  requiredEnv('CONDUCTOR_BASE_URL');
  requiredEnv('CONDUCTOR_TOKEN');

  const studioBaseUrl = requiredEnv('STUDIO_BASE_URL');
  requireAbsoluteUrl('STUDIO_BASE_URL', studioBaseUrl, true);

  const emailProvider = requiredEnv('EMAIL_PROVIDER').toLowerCase();
  if (emailProvider !== 'resend') {
    throw new Error('EMAIL_PROVIDER must be "resend" in production');
  }
  requiredEnv('EMAIL_FROM');
  requiredEnv('RESEND_API_KEY');

  requiredEnv('GITHUB_CLIENT_ID');
  requiredEnv('GITHUB_CLIENT_SECRET');
  const githubCallback = requiredEnv('GITHUB_CALLBACK_URL');
  requireAbsoluteUrl('GITHUB_CALLBACK_URL', githubCallback, true);
}

export async function register() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  validateProductionEnv();
}
