'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { Dictionary } from '@/i18n';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

export default function AIChat({ reportId, issueId, dict }: { reportId: string; issueId?: string; dict: Dictionary }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date().toISOString() }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/reports/${reportId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, conversationId, issueId })
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? dict.reportDetail.aiChatSendFailed);
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      setConversationId(data.conversationId);
      setMessages(prev => [...prev, { role: 'assistant', content: data.message, timestamp: new Date().toISOString() }]);
    } catch {
      toast.error(dict.reportDetail.aiChatNetworkError);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <MessageCircle className="size-12 text-muted-foreground" />
            <div className="text-sm font-semibold">{dict.reportDetail.aiChatEmptyTitle}</div>
            <div className="text-xs text-muted-foreground max-w-sm">
              {dict.reportDetail.aiChatEmptyDescription}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
              }`}>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                <div className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2.5">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border bg-card p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={dict.reportDetail.aiChatInputPlaceholder}
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!input.trim() || loading} size="icon">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
