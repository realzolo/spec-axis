'use client';

import { useState, useEffect } from 'react';
import { Button } from '@heroui/react';
import { Github, Layers, Key, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type GitHubStatus = {
  login: string; name: string | null; avatar_url: string;
  public_repos: number; total_private_repos: number; html_url: string;
};

export default function SettingsPage() {
  const [ghStatus, setGhStatus] = useState<GitHubStatus | null>(null);
  const [ghLoading, setGhLoading] = useState(true);
  const [ghError, setGhError] = useState('');

  async function fetchGitHubStatus() {
    setGhLoading(true); setGhError('');
    try {
      const res = await fetch('/api/github/status');
      const data = await res.json();
      if (!res.ok) { setGhError(data.error ?? '连接失败'); setGhStatus(null); }
      else { setGhStatus(data); }
    } catch { setGhError('网络错误'); }
    finally { setGhLoading(false); }
  }

  useEffect(() => { fetchGitHubStatus(); }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-7 h-[60px] flex items-center bg-white border-b border-[#eaecf0] shrink-0">
        <div>
          <div className="text-[15px] font-bold text-[#101828]">设置</div>
          <div className="text-xs text-[#667085] mt-0.5">环境变量与连接状态</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-7 bg-[#f0f2f5]">
        <div className="max-w-[640px] flex flex-col gap-4">

          {/* GitHub */}
          <div className="bg-white rounded-xl border border-[#eaecf0] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#eff4ff] flex items-center justify-center shrink-0">
                  <Github className="size-5 text-[#4f6ef7]" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#101828]">GitHub 访问令牌</div>
                  <div className="text-xs text-[#667085] mt-0.5">
                    仓库访问 PAT ·{' '}
                    <code className="text-[11px] bg-[#f2f4f7] px-1.5 py-0.5 rounded">GITHUB_PAT</code>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" isLoading={ghLoading} onPress={fetchGitHubStatus} className="gap-1.5 shrink-0">
                <RefreshCw className="size-3.5" />
                测试连接
              </Button>
            </div>

            {ghLoading ? (
              <div className="flex items-center gap-2 py-2.5">
                <Loader2 className="size-4 animate-spin text-[#667085]" />
                <span className="text-[13px] text-[#667085]">正在测试连接…</span>
              </div>
            ) : ghError ? (
              <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-[#fff1f3] border border-[#fecdd3]">
                <AlertCircle className="size-4 text-[#c01048] shrink-0" />
                <div>
                  <div className="text-[13px] font-semibold text-[#c01048]">连接失败</div>
                  <div className="text-xs text-[#e11d48] mt-0.5">{ghError}</div>
                </div>
              </div>
            ) : ghStatus ? (
              <div className="flex items-center gap-3.5 px-3.5 py-3 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0]">
                <img src={ghStatus.avatar_url} alt={ghStatus.login} className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#101828]">{ghStatus.name ?? ghStatus.login}</span>
                    <span className="text-xs text-[#667085]">@{ghStatus.login}</span>
                    <CheckCircle className="size-4 text-[#16a34a]" />
                  </div>
                  <div className="text-xs text-[#667085] mt-0.5">
                    {ghStatus.public_repos} 个公开 · {ghStatus.total_private_repos} 个私有仓库
                  </div>
                </div>
                <a href={ghStatus.html_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-[#4f6ef7] no-underline shrink-0 hover:underline">
                  查看主页 →
                </a>
              </div>
            ) : null}
          </div>

          {/* Anthropic */}
          <div className="bg-white rounded-xl border border-[#eaecf0] p-6 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#f4f0ff] flex items-center justify-center shrink-0">
              <Layers className="size-5 text-[#7c3aed]" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-[#101828] mb-0.5">Claude API 密钥</div>
              <div className="text-xs text-[#667085]">
                Anthropic AI 分析密钥 ·{' '}
                <code className="text-[11px] bg-[#f2f4f7] px-1.5 py-0.5 rounded">ANTHROPIC_API_KEY</code>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ecfdf3] text-[11px] font-semibold text-[#027a48] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16b364] block" />
              已通过环境变量配置
            </div>
          </div>

          {/* Supabase */}
          <div className="bg-white rounded-xl border border-[#eaecf0] p-6 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#ecfdf3] flex items-center justify-center shrink-0">
              <Key className="size-5 text-[#027a48]" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-[#101828] mb-0.5">Supabase</div>
              <div className="text-xs text-[#667085]">
                数据库与认证 ·{' '}
                <code className="text-[11px] bg-[#f2f4f7] px-1.5 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code>
                {' + '}
                <code className="text-[11px] bg-[#f2f4f7] px-1.5 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ecfdf3] text-[11px] font-semibold text-[#027a48] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16b364] block" />
              已通过环境变量配置
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
