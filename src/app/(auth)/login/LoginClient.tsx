'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import NexalyMark from '@/components/common/NexalyMark';
import type { Dictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';

interface LoginClientProps {
  dict: Dictionary;
  locale: Locale;
}

export default function LoginClient({ dict, locale }: LoginClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const currentYear = new Date().getFullYear();

  const GoogleMark = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path fill="#EA4335" d="M24 9.5c3.2 0 6.1 1.1 8.4 3.2l6.1-6.1C34.6 2.5 29.6 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.1 5.5C11.5 13.1 17.2 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.2H24v8h12.6c-.5 3.1-2.4 5.8-5.2 7.5l6.3 4.9c3.7-3.4 5.9-8.4 5.9-14.2z" />
      <path fill="#FBBC05" d="M9.6 28.7c-.6-1.7-.9-3.5-.9-5.4 0-1.9.3-3.7.9-5.4l-7.1-5.5C.9 15.2 0 19.5 0 23.3c0 3.8.9 8.1 2.5 11.4l7.1-6z" />
      <path fill="#34A853" d="M24 46.5c5.6 0 10.3-1.8 13.8-4.8l-6.3-4.9c-1.7 1.2-4.1 2.1-7.5 2.1-6.8 0-12.5-3.6-15.1-9.2l-7.1 5.5C6.5 42.6 14.6 46.5 24 46.5z" />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );

  const GithubMark = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M12 0.5a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.02c-3.23.7-3.91-1.55-3.91-1.55-.53-1.33-1.3-1.68-1.3-1.68-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.41-1.27.75-1.56-2.58-.3-5.3-1.29-5.3-5.74 0-1.27.46-2.3 1.2-3.12-.12-.3-.52-1.52.11-3.16 0 0 .98-.31 3.2 1.2a11 11 0 0 1 5.82 0c2.22-1.51 3.2-1.2 3.2-1.2.63 1.64.23 2.86.12 3.16.75.82 1.2 1.85 1.2 3.12 0 4.46-2.72 5.44-5.3 5.73.42.36.8 1.08.8 2.18v3.22c0 .31.2.67.8.56A11.5 11.5 0 0 0 12 0.5z"
      />
    </svg>
  );

  useEffect(() => {
    setCode('');
    setCodeSent(false);
  }, [email]);

  async function handleOAuth(provider: 'google' | 'github') {
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

  async function handleSendCode() {
    if (!email.trim()) {
      toast.error(dict.auth.emailRequired);
      return;
    }

    setSendingCode(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) throw error;
      setCodeSent(true);
      toast.success(dict.auth.codeSent);
    } catch {
      toast.error(dict.auth.sendCodeFailed);
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();

    if (!code.trim()) {
      toast.error(dict.auth.codeRequired);
      return;
    }

    setVerifyingCode(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      });

      if (error) throw error;

      router.push('/projects');
      router.refresh();
    } catch {
      toast.error(dict.auth.verifyCodeFailed);
    } finally {
      setVerifyingCode(false);
    }
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
            <div className="px-8 pt-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
                <NexalyMark className="h-7 w-7" />
              </div>
              <div className="text-base font-semibold">Nexaly</div>
              <div className="text-sm text-muted-foreground">{dict.auth.login}</div>
            </div>

            <div className="px-8 pb-8 pt-6 space-y-6">
              <div className="grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-center gap-2 text-sm"
                  disabled={oauthLoading !== null}
                  onClick={() => handleOAuth('google')}
                >
                  <GoogleMark className="h-4 w-4" />
                  {dict.auth.continueWithGoogle}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-center gap-2 text-sm"
                  disabled={oauthLoading !== null}
                  onClick={() => handleOAuth('github')}
                >
                  <GithubMark className="h-4 w-4 text-foreground" />
                  {dict.auth.continueWithGithub}
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{dict.auth.orContinueWithEmail}</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-2 text-left">
                  <label className="text-sm font-medium">
                    {dict.auth.email}
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={dict.auth.emailPlaceholder}
                    required
                    disabled={sendingCode || verifyingCode}
                    className="h-11 text-sm"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full text-sm"
                    onClick={handleSendCode}
                    disabled={sendingCode}
                  >
                    {sendingCode ? dict.common.loading : (codeSent ? dict.auth.resendCode : dict.auth.sendCode)}
                  </Button>
                  <div className="hidden sm:flex items-center justify-end text-[11px] text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    {dict.auth.emailCodeTab}
                  </div>
                </div>

                {codeSent && (
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="space-y-2 text-left">
                      <label className="text-sm font-medium">
                        {dict.auth.codeLabel}
                      </label>
                      <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder={dict.auth.codePlaceholder}
                        disabled={verifyingCode}
                        className="h-11 text-sm"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="h-11 w-full text-sm"
                      disabled={!codeSent || verifyingCode}
                    >
                      {verifyingCode ? dict.common.loading : dict.auth.verifyCode}
                    </Button>
                  </div>
                )}
              </form>
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
