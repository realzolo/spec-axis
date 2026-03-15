'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import NexalyMark from '@/components/common/NexalyMark';
import { cn } from '@/lib/utils';
import type { Dictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';

interface LoginClientProps {
  dict: Dictionary;
  locale: Locale;
  legalLinks: {
    terms: string;
    privacy: string;
  };
}

export default function LoginClient({ dict, locale, legalLinks }: LoginClientProps) {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'github' | null>(null);
  const currentYear = new Date().getFullYear();

  const GithubMark = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M12 0.5a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.02c-3.23.7-3.91-1.55-3.91-1.55-.53-1.33-1.3-1.68-1.3-1.68-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.41-1.27.75-1.56-2.58-.3-5.3-1.29-5.3-5.74 0-1.27.46-2.3 1.2-3.12-.12-.3-.52-1.52.11-3.16 0 0 .98-.31 3.2 1.2a11 11 0 0 1 5.82 0c2.22-1.51 3.2-1.2 3.2-1.2.63 1.64.23 2.86.12 3.16.75.82 1.2 1.85 1.2 3.12 0 4.46-2.72 5.44-5.3 5.73.42.36.8 1.08.8 2.18v3.22c0 .31.2.67.8.56A11.5 11.5 0 0 0 12 0.5z"
      />
    </svg>
  );

  async function resolveOrgRedirect(): Promise<string> {
    try {
      const res = await fetch('/api/orgs/active');
      if (!res.ok) return '/projects';
      const data = await res.json();
      if (data?.orgId) return `/o/${data.orgId}/projects`;
    } catch {}
    return '/projects';
  }

  async function handleOAuth(provider: 'github') {
    setOauthLoading(provider);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch {
      toast.error(dict.auth.oauthFailed);
      setOauthLoading(null);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      const nextPath = await resolveOrgRedirect();
      router.push(nextPath);
      router.refresh();
    } catch {
      toast.error(dict.auth.loginFailed);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      toast.error(dict.auth.emailRequired);
      return;
    }

    if (!password.trim()) {
      toast.error(dict.auth.passwordRequired);
      return;
    }

    const strengthScore = getPasswordStrengthScore(password);
    if (strengthScore < 3) {
      toast.error(dict.auth.passwordTooWeak);
      return;
    }

    setSigningUp(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      const nextPath = await resolveOrgRedirect();
      router.push(nextPath);
      router.refresh();
    } catch {
      toast.error(dict.auth.signUpFailed);
    } finally {
      setSigningUp(false);
    }
  }

  function getPasswordStrengthScore(value: string) {
    const lengthOk = value.length >= 8;
    const hasUpper = /[A-Z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSymbol = /[^A-Za-z0-9]/.test(value);
    return [lengthOk, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
  }

  function getPasswordStrengthLabel(value: string) {
    if (!value.trim()) {
      return { label: dict.auth.passwordStrengthEmpty, color: 'text-muted-foreground' };
    }
    const score = getPasswordStrengthScore(value);
    if (score >= 4) return { label: dict.auth.passwordStrengthStrong, color: 'text-success' };
    if (score >= 2) return { label: dict.auth.passwordStrengthMedium, color: 'text-warning' };
    return { label: dict.auth.passwordStrengthWeak, color: 'text-danger' };
  }

  return (
    <div className="auth-page">
      <div className="auth-tools">
        <div className="auth-tool">
          <span className="auth-tool-label">{dict.settings.language}</span>
          <LanguageSwitcher currentLocale={locale} />
        </div>
        <div className="auth-tool">
          <span className="auth-tool-label">{dict.settings.theme}</span>
          <ThemeToggle />
        </div>
      </div>
      <div className="auth-main">
        <div className="auth-stack">
          <Card className="auth-card">
            <div className="px-8 pt-8 pb-8 space-y-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-transparent">
                    <NexalyMark className="h-9 w-9" />
                  </div>
                  <div className="text-heading-20">Nexaly</div>
                </div>
                <div className="text-copy-14">
                  {mode === 'login' ? dict.auth.login : dict.auth.signUpTitle}
                </div>
              </div>

              <div className="grid gap-2 max-w-[320px] w-full mx-auto">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-center gap-2 px-4"
                  disabled={oauthLoading !== null}
                  onClick={() => handleOAuth('github')}
                >
                  <GithubMark className="h-4 w-4 text-foreground" />
                  {dict.auth.continueWithGithub}
                </Button>
              </div>

              <div className="flex w-full max-w-[320px] mx-auto items-center gap-3 text-label-11 uppercase tracking-wide text-muted-foreground">
                <span className="auth-divider auth-divider--left" aria-hidden="true" />
                <span>{dict.auth.orContinueWithEmail}</span>
                <span className="auth-divider auth-divider--right" aria-hidden="true" />
              </div>

              {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4 max-w-[320px] w-full mx-auto text-left">
                  <div className="space-y-2">
                    <label className="text-label-14">
                      {dict.auth.email}
                    </label>
                    <Input
                      ref={emailRef}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={dict.auth.emailPlaceholder}
                      required
                      disabled={loading}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-label-14">
                      {dict.auth.password}
                    </label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={dict.auth.passwordPlaceholder}
                      required
                      disabled={loading}
                      className="h-10"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    className="h-11 w-full shadow-sm border border-border"
                    disabled={loading}
                  >
                    {loading ? dict.common.loading : dict.auth.signIn}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-4 max-w-[320px] w-full mx-auto text-left">
                  <div className="space-y-2">
                    <label className="text-label-14">
                      {dict.auth.email}
                    </label>
                    <Input
                      ref={emailRef}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={dict.auth.emailPlaceholder}
                      required
                      disabled={signingUp}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-label-14">
                      {dict.auth.password}
                    </label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={dict.auth.passwordPlaceholder}
                      required
                      disabled={signingUp}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-copy-12">
                      <span>{dict.auth.passwordStrength}</span>
                      <span className={cn('font-medium', getPasswordStrengthLabel(password).color)}>
                        {getPasswordStrengthLabel(password).label}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <span
                          key={index}
                          className={cn(
                            'h-1 rounded-full bg-muted',
                            password.trim() && index < getPasswordStrengthScore(password) && 'bg-accent',
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    className="h-11 w-full shadow-sm border border-border"
                    disabled={signingUp || getPasswordStrengthScore(password) < 3}
                  >
                    {signingUp ? dict.common.loading : dict.auth.signUpAction}
                  </Button>
                </form>
              )}

              <div className="text-center text-copy-12">
                {mode === 'login' ? dict.auth.signUpPrompt : dict.auth.signInPrompt}{' '}
                <button
                  type="button"
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-foreground hover:underline"
                >
                  {mode === 'login' ? dict.auth.signUpAction : dict.auth.signInAction}
                </button>
              </div>

              <div className="text-center text-copy-12 leading-relaxed text-muted-foreground">
                {dict.auth.termsNotice.split(/(\{terms\}|\{privacy\})/g).map((segment, index) => {
                  if (segment === '{terms}') {
                    return (
                      <Link key={`terms-${index}`} href={legalLinks.terms} className="text-foreground hover:underline">
                        {dict.auth.termsOfService}
                      </Link>
                    );
                  }
                  if (segment === '{privacy}') {
                    return (
                      <Link key={`privacy-${index}`} href={legalLinks.privacy} className="text-foreground hover:underline">
                        {dict.auth.privacyPolicy}
                      </Link>
                    );
                  }
                  return <span key={`text-${index}`}>{segment}</span>;
                })}
              </div>
            </div>
          </Card>
        </div>
      </div>
      <div className="auth-footer">
        © {currentYear} Nexaly. All rights reserved.
      </div>
    </div>
  );
}
