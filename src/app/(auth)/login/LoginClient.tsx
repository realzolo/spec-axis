'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chrome, Github, Mail, KeyRound } from 'lucide-react';
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
  const [mode, setMode] = useState<'password' | 'code'>('code');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const currentYear = new Date().getFullYear();

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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.push('/projects');
      router.refresh();
    } catch (error) {
      toast.error(dict.auth.loginFailed);
    } finally {
      setLoading(false);
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
            <div className="flex flex-col items-center gap-6">
            <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center shadow-lg ring-1 ring-foreground/10">
              <NexalyMark className="h-7 w-7" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-semibold">Nexaly</h1>
              <p className="text-sm text-muted-foreground mt-1">{dict.auth.login}</p>
            </div>

              <div className="w-full space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  disabled={oauthLoading !== null}
                  onClick={() => handleOAuth('google')}
                >
                  <span className="flex items-center gap-2">
                    <Chrome className="h-4 w-4" />
                    {dict.auth.continueWithGoogle}
                  </span>
                  {oauthLoading === 'google' ? <span className="text-xs text-muted-foreground">{dict.common.loading}</span> : null}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  disabled={oauthLoading !== null}
                  onClick={() => handleOAuth('github')}
                >
                  <span className="flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    {dict.auth.continueWithGithub}
                  </span>
                  {oauthLoading === 'github' ? <span className="text-xs text-muted-foreground">{dict.common.loading}</span> : null}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-2 text-xs text-muted-foreground">{dict.auth.orContinueWithEmail}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-1 bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setMode('password')}
                    className={[
                      'h-8 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
                      mode === 'password' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    {dict.auth.passwordTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('code')}
                    className={[
                      'h-8 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
                      mode === 'code' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {dict.auth.emailCodeTab}
                  </button>
                </div>

                {mode === 'password' ? (
                  <form onSubmit={handleLogin} className="w-full space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        {dict.auth.email}
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={dict.auth.emailPlaceholder}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        {dict.auth.password}
                      </label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={dict.auth.passwordPlaceholder}
                        required
                        disabled={loading}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading}
                    >
                      {loading ? dict.common.loading : dict.auth.signIn}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyCode} className="w-full space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        {dict.auth.email}
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={dict.auth.emailPlaceholder}
                        required
                        disabled={sendingCode || verifyingCode}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleSendCode}
                      disabled={sendingCode}
                    >
                      {sendingCode ? dict.common.loading : (codeSent ? dict.auth.resendCode : dict.auth.sendCode)}
                    </Button>

                    {codeSent && (
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          {dict.auth.codeLabel}
                        </label>
                        <Input
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          placeholder={dict.auth.codePlaceholder}
                          disabled={verifyingCode}
                        />
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={!codeSent || verifyingCode}
                    >
                      {verifyingCode ? dict.common.loading : dict.auth.verifyCode}
                    </Button>
                  </form>
                )}
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
