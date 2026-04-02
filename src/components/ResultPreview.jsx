import React, { useState } from 'react';
import { FileText, Copy, Check } from 'lucide-react';

export default function ResultPreview({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!text) return null;

  return (
    <div className="glass-card rounded-2xl overflow-hidden" style={{ borderColor: 'rgba(0,245,255,0.12)' }}>
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,245,255,0.08)', background: 'rgba(0,245,255,0.03)' }}>
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4" style={{ color: '#00f5ff' }} />
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#00f5ff' }}>プレビュー</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
          style={{
            background: 'rgba(0,245,255,0.06)',
            border: '1px solid rgba(0,245,255,0.15)',
            color: copied ? '#00ff88' : 'rgba(0,245,255,0.8)',
          }}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'コピーしました！' : 'コピー'}</span>
        </button>
      </div>
      {/* Content */}
      <div className="p-6 min-h-48 max-h-96 overflow-y-auto">
        <p className="whitespace-pre-wrap leading-relaxed text-sm text-slate-300">
          {text}
        </p>
      </div>
    </div>
  );
}
