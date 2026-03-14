'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Pencil, Shield } from 'lucide-react';
import { Button, Input, TextArea, Select, ListBox, Switch, Modal, useOverlayState, Tooltip } from '@heroui/react';
import { toast } from 'sonner';

type Rule = {
  id: string; ruleset_id: string; category: string; name: string;
  prompt: string; weight: number; severity: 'error' | 'warning' | 'info';
  is_enabled: boolean; sort_order: number;
};
type RuleSet = { id: string; name: string; description?: string; is_global: boolean; rules: Rule[] };

const CATEGORIES = ['style', 'security', 'architecture', 'performance', 'maintainability'];
const CAT_LABEL: Record<string, string> = { style: '风格', security: '安全', architecture: '架构', performance: '性能', maintainability: '可维护性' };

const CATEGORY_COLOR: Record<string, string> = {
  style: '#4f6ef7', security: '#c01048', architecture: '#027a48',
  performance: '#b54708', maintainability: '#6941c6',
};
const CATEGORY_BG: Record<string, string> = {
  style: '#eff4ff', security: '#fff1f3', architecture: '#ecfdf3',
  performance: '#fffaeb', maintainability: '#f4f0ff',
};
const SEV_COLOR: Record<string, string> = { error: '#c01048', warning: '#b54708', info: '#027a48' };
const SEV_BG: Record<string, string> = { error: '#fff1f3', warning: '#fffaeb', info: '#ecfdf3' };
const SEV_LABEL: Record<string, string> = { error: '错误', warning: '警告', info: '提示' };

const EMPTY_RULE = { category: 'style', name: '', prompt: '', weight: 20, severity: 'warning' as const, is_enabled: true };

const CAT_ITEMS = CATEGORIES.map(c => ({ id: c, label: CAT_LABEL[c] ?? c }));
const SEV_ITEMS = [
  { id: 'error', label: '错误' },
  { id: 'warning', label: '警告' },
  { id: 'info', label: '提示' },
];

export default function RuleSetDetailClient({ initialRuleSet }: { initialRuleSet: RuleSet }) {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>(initialRuleSet.rules ?? []);
  const [showAdd, setShowAdd] = useState(false);
  const [editRule, setEditRule] = useState<Rule | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [fCategory, setFCategory] = useState('style');
  const [fSeverity, setFSeverity] = useState<'error' | 'warning' | 'info'>('warning');
  const [fName, setFName] = useState('');
  const [fPrompt, setFPrompt] = useState('');
  const [fWeight, setFWeight] = useState(20);

  const modalState = useOverlayState({
    isOpen: showAdd,
    onOpenChange: (v) => { if (!v) { setShowAdd(false); setEditRule(null); } },
  });

  function openAdd() {
    setEditRule(null);
    const r = EMPTY_RULE;
    setFCategory(r.category); setFSeverity(r.severity); setFName(r.name); setFPrompt(r.prompt); setFWeight(r.weight);
    setShowAdd(true);
  }

  function openEdit(rule: Rule) {
    setEditRule(rule);
    setFCategory(rule.category); setFSeverity(rule.severity); setFName(rule.name); setFPrompt(rule.prompt); setFWeight(rule.weight);
    setShowAdd(true);
  }

  async function handleSaveRule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = editRule
      ? { id: editRule.id, category: fCategory, severity: fSeverity, name: fName, prompt: fPrompt, weight: fWeight }
      : { category: fCategory, severity: fSeverity, name: fName, prompt: fPrompt, weight: fWeight };
    const res = await fetch(`/api/rules/${initialRuleSet.id}/rules`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(data.error ?? '保存失败'); return; }
    toast.success(editRule ? '规则已更新' : '规则已创建');
    setShowAdd(false); setEditRule(null);
    const fresh = await fetch(`/api/rules/${initialRuleSet.id}`).then(r => r.json());
    setRules(fresh.rules ?? []);
  }

  async function handleToggle(rule: Rule) {
    setTogglingId(rule.id);
    const res = await fetch(`/api/rules/${initialRuleSet.id}/rules`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, is_enabled: !rule.is_enabled }),
    });
    setTogglingId(null);
    if (!res.ok) { toast.error('更新失败'); return; }
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_enabled: !r.is_enabled } : r));
  }

  async function handleDelete(ruleId: string) {
    const res = await fetch(`/api/rules/${initialRuleSet.id}/rules`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ruleId }),
    });
    if (!res.ok) { toast.error('删除失败'); return; }
    toast.success('规则已删除');
    setRules(prev => prev.filter(r => r.id !== ruleId));
  }

  const grouped = CATEGORIES.reduce<Record<string, Rule[]>>((acc, cat) => {
    acc[cat] = rules.filter(r => r.category === cat);
    return acc;
  }, {});

  const enabledCount = rules.filter(r => r.is_enabled).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 h-[60px] bg-white border-b border-[#eaecf0] shrink-0">
        <Button isIconOnly variant="ghost" className="h-8 w-8" onPress={() => router.push('/rules')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center border border-[#e0e7ff]"
          style={{ background: 'linear-gradient(135deg, #eff4ff 0%, #f4f0ff 100%)' }}>
          <Shield className="size-4 text-[#4f6ef7]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-[#101828]">
            {initialRuleSet.name}
            {initialRuleSet.is_global && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f4f0ff] text-[#6941c6]">全局</span>
            )}
          </div>
          {initialRuleSet.description && <div className="text-xs text-[#667085] mt-0.5">{initialRuleSet.description}</div>}
        </div>
        <div className="text-xs text-[#667085] mr-2">
          <span className="text-[#027a48] font-semibold">{enabledCount}</span>/{rules.length} 已启用
        </div>
        <Button size="sm" onPress={openAdd} className="gap-1.5 font-semibold">
          <Plus className="size-4" />
          添加规则
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-[#f0f2f5] flex flex-col gap-4">
        {CATEGORIES.map(cat => {
          const catRules = grouped[cat];
          if (catRules.length === 0) return null;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold capitalize"
                  style={{ background: CATEGORY_BG[cat], color: CATEGORY_COLOR[cat] }}>
                  {CAT_LABEL[cat] ?? cat}
                </span>
                <span className="text-xs text-[#98a2b3]">{catRules.length} 条规则</span>
              </div>
              <div className="flex flex-col gap-2">
                {catRules.map(rule => (
                  <div key={rule.id} className="bg-white rounded-xl border px-[18px] py-3.5 transition-opacity"
                    style={{ borderColor: rule.is_enabled ? '#eaecf0' : '#f2f4f7', opacity: rule.is_enabled ? 1 : 0.6 }}>
                    <div className="flex items-start gap-3">
                      <Switch
                        isSelected={rule.is_enabled}
                        isDisabled={togglingId === rule.id}
                        onChange={() => handleToggle(rule)}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[13px] font-bold text-[#101828]">{rule.name}</span>
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                            style={{ background: SEV_BG[rule.severity], color: SEV_COLOR[rule.severity] }}>
                            {SEV_LABEL[rule.severity]}
                          </span>
                          <span className="text-[11px] text-[#98a2b3]">权重: {rule.weight}</span>
                        </div>
                        <div className="text-xs text-[#667085] leading-relaxed bg-[#f8f9fc] rounded-md px-3 py-2 font-mono whitespace-pre-wrap">
                          {rule.prompt}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Tooltip content="编辑">
                          <Button isIconOnly variant="ghost" className="h-7 w-7 text-[#667085]" onPress={() => openEdit(rule)}>
                            <Pencil className="size-3.5" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="删除">
                          <Button isIconOnly variant="ghost" className="h-7 w-7 text-[#98a2b3] hover:text-red-500" onPress={() => handleDelete(rule.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {rules.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 min-h-[300px]">
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#eaecf0] flex items-center justify-center">
              <Shield className="size-6 text-[#98a2b3]" />
            </div>
            <div className="text-sm font-semibold text-[#344054]">暂无规则</div>
            <div className="text-[13px] text-[#667085]">添加规则以定义 Claude 应检查的内容</div>
            <Button size="sm" onPress={openAdd} className="mt-1 gap-1.5">
              <Plus className="size-4" />
              添加规则
            </Button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal state={modalState}>
        <Modal.Backdrop isDismissable>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{editRule ? '编辑规则' : '添加规则'}</Modal.Heading>
              </Modal.Header>
              <form onSubmit={handleSaveRule}>
                <Modal.Body className="flex flex-col gap-4 mt-2">
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-sm font-medium">分类</label>
                      <Select selectedKey={fCategory} onSelectionChange={(key) => setFCategory(key as string)}>
                        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                        <Select.Popover>
                          <ListBox items={CAT_ITEMS}>
                            {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5 w-[130px]">
                      <label className="text-sm font-medium">严重级别</label>
                      <Select selectedKey={fSeverity} onSelectionChange={(key) => setFSeverity(key as 'error' | 'warning' | 'info')}>
                        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                        <Select.Popover>
                          <ListBox items={SEV_ITEMS}>
                            {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">规则名称</label>
                    <Input value={fName} onChange={e => setFName(e.target.value)} placeholder="例如：禁止硬编码密钥" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">提示词（Claude 的检查指令）</label>
                    <TextArea value={fPrompt} onChange={e => setFPrompt(e.target.value)}
                      placeholder="描述 Claude 应检查的内容…" required rows={4} className="font-mono text-[13px]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">权重（0–100）</label>
                    <Input type="number" min={0} max={100} step={5} value={String(fWeight)}
                      onChange={e => setFWeight(Number(e.target.value))} className="w-[120px]" />
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button type="button" variant="outline" onPress={() => { setShowAdd(false); setEditRule(null); }}>取消</Button>
                  <Button type="submit" isLoading={saving}>{editRule ? '保存更改' : '添加规则'}</Button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
