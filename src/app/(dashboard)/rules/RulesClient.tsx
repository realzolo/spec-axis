'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Shield, ChevronRight } from 'lucide-react';
import { Button, Input, Modal, useOverlayState } from '@heroui/react';
import { toast } from 'sonner';

type RuleSet = { id: string; name: string; description?: string; is_global: boolean; rules?: unknown[] };

export default function RulesClient({ initialRuleSets }: { initialRuleSets: RuleSet[] }) {
  const router = useRouter();
  const [ruleSets, setRuleSets] = useState<RuleSet[]>(initialRuleSets);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const modalState = useOverlayState({ isOpen: showCreate, onOpenChange: (v) => { if (!v) setShowCreate(false); } });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch('/api/rules/sets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { toast.error(data.error); return; }
    toast.success('规则集已创建');
    setShowCreate(false);
    setName(''); setDescription('');
    const updated = await fetch('/api/rules/sets').then(r => r.json());
    setRuleSets(updated);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-7 h-[60px] bg-white border-b border-[#eaecf0] shrink-0">
        <div>
          <div className="text-[15px] font-bold text-[#101828]">规则集</div>
          <div className="text-xs text-[#667085] mt-0.5">为每个项目配置审查规则</div>
        </div>
        <Button size="sm" onPress={() => setShowCreate(true)} className="gap-1.5 font-semibold">
          <Plus className="size-4" />
          新建规则集
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-7 bg-[#f0f2f5]">
        {ruleSets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#eaecf0] flex items-center justify-center shadow-sm">
              <Shield className="size-6 text-[#98a2b3]" />
            </div>
            <div className="text-sm font-semibold text-[#344054]">暂无规则集</div>
            <div className="text-[13px] text-[#667085]">创建第一个规则集开始使用</div>
            <Button size="sm" onPress={() => setShowCreate(true)} className="mt-1 gap-1.5">
              <Plus className="size-4" />
              新建规则集
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {ruleSets.map(rs => {
              const total = (rs.rules as unknown[])?.length ?? 0;
              const enabled = (rs.rules as { is_enabled: boolean }[])?.filter(r => r.is_enabled).length ?? 0;
              return (
                <div
                  key={rs.id}
                  onClick={() => router.push(`/rules/${rs.id}`)}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl cursor-pointer border border-[#eaecf0] bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-px"
                >
                  <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border border-[#e0e7ff]"
                    style={{ background: 'linear-gradient(135deg, #eff4ff 0%, #f4f0ff 100%)' }}>
                    <Shield className="size-4 text-[#4f6ef7]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-[#101828]">{rs.name}</span>
                      {rs.is_global && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f4f0ff] text-[#6941c6]">全局</span>
                      )}
                    </div>
                    <div className="text-xs text-[#667085]">
                      {total} 条规则 · <span className="text-[#027a48] font-semibold">{enabled} 条已启用</span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-[#d0d5dd] shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal state={modalState}>
        <Modal.Backdrop isDismissable>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>新建规则集</Modal.Heading>
              </Modal.Header>
              <form onSubmit={handleCreate}>
                <Modal.Body className="flex flex-col gap-4 mt-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">名称</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="例如：Nuxt SaaS 规则" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">描述 <span className="text-[#98a2b3] font-normal">（可选）</span></label>
                    <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="这个规则集用于什么？" />
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button type="button" variant="outline" onPress={() => setShowCreate(false)}>取消</Button>
                  <Button type="submit" isLoading={creating}>创建</Button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
