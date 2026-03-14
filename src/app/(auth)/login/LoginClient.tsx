'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Code2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Dictionary } from '@/i18n';

interface LoginClientProps {
  dict: Dictionary;
}

export default function LoginClient({ dict }: LoginClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
      toast.error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
        <CardContent className="p-8">
          <div className="flex flex-col items-center gap-6">
            <div className="w-12 h-12 rounded-xl bg-foreground flex items-center justify-center shadow-lg ring-1 ring-foreground/20">
              <Code2 className="text-background size-6" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-semibold">spec-axis</h1>
              <p className="text-sm text-muted-foreground mt-1">{dict.auth.login}</p>
            </div>

            <form onSubmit={handleLogin} className="w-full space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {dict.auth.email}
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
