import React, { useState } from 'react';
import { KeyRound, X, CheckCircle2, SlidersHorizontal, Plus, Trash2, Pencil, Check, Eye, EyeOff, LayoutTemplate, Settings2 } from 'lucide-react';

export default function SettingsModal({ settings, onSave, onClose }) {
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'rules' | 'patterns'
  
  const [openaiKey, setOpenaiKey] = useState(settings?.openaiKey || '');
  const [anthropicKey, setAnthropicKey] = useState(settings?.anthropicKey || '');
  const [authorName, setAuthorName] = useState(settings?.authorName || '');
  const [transcriptionHint, setTranscriptionHint] = useState(settings?.transcriptionHint || '');
  
  // 要件リスト
  const [customRules, setCustomRules] = useState(settings?.customRules || []);
  const [newRuleText, setNewRuleText] = useState('');
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [editingRuleText, setEditingRuleText] = useState('');

  // 構成パターンリスト
  const [structurePatterns, setStructurePatterns] = useState(settings?.structurePatterns || []);
  const [newPatternName, setNewPatternName] = useState('');
  const [newPatternText, setNewPatternText] = useState('');
  const [editingPatternId, setEditingPatternId] = useState(null);
  const [editingPatternName, setEditingPatternName] = useState('');
  const [editingPatternText, setEditingPatternText] = useState('');
  
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave({ 
      openaiKey, 
      anthropicKey, 
      authorName, 
      customRules,
      structurePatterns,
      transcriptionHint,
      customInstructions: customRules.filter(r => r.enabled).map(r => r.text).join('\n')
    });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  };

  // ── 汎用リスト操作 ──────────────────────────
  const addRule = () => {
    if (!newRuleText.trim()) return;
    setCustomRules([...customRules, { id: Date.now().toString(), text: newRuleText.trim(), enabled: true }]);
    setNewRuleText('');
  };

  const addPattern = () => {
    if (!newPatternName.trim() || !newPatternText.trim()) return;
    setStructurePatterns([...structurePatterns, { 
      id: Date.now().toString(), 
      name: newPatternName.trim(), 
      text: newPatternText.trim() 
    }]);
    setNewPatternName('');
    setNewPatternText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 selection-cyan" style={{ background: 'rgba(5,5,15,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="glass-card rounded-3xl w-full max-w-3xl overflow-hidden flex flex-col h-[85vh]" style={{ borderColor: 'rgba(0,245,255,0.2)' }}>
        
        {/* Header */}
        <div className="px-8 py-5 flex items-center justify-between bg-dark-900/50" style={{ borderBottom: '1px solid rgba(0,245,255,0.1)' }}>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Settings2 className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-lg font-black tracking-wider text-cyan-400 uppercase" style={{ textShadow: '0 0 10px rgba(0,245,255,0.3)' }}>Advanced Settings</span>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-xl transition-all hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-4 bg-dark-950/40" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { id: 'basic', label: '基本設定', icon: KeyRound },
            { id: 'rules', label: 'リライト要件', icon: SlidersHorizontal },
            { id: 'patterns', label: '構成パターン', icon: LayoutTemplate },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-xs font-bold tracking-widest uppercase transition-all relative ${activeTab === tab.id ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_10px_rgba(0,245,255,0.8)]" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* 1. 基本設定 */}
          {activeTab === 'basic' && (
            <div className="max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500/60 flex items-center gap-2">
                  <div className="w-1 h-1 bg-cyan-500 rounded-full" /> OpenAI API Key (Whisper)
                </label>
                <input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..." className="neon-input" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500/60 flex items-center gap-2">
                  <div className="w-1 h-1 bg-purple-500 rounded-full" /> Anthropic API Key (Claude)
                </label>
                <input type="password" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..." className="neon-input" style={{ borderColor: 'rgba(191,95,255,0.2)' }} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-green-500/60 flex items-center gap-2">
                  <div className="w-1 h-1 bg-green-500 rounded-full" /> Author Name (EPUB Meta)
                </label>
                <input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="例：山田 太郎" className="neon-input" style={{ borderColor: 'rgba(0,255,136,0.2)' }} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500/60 flex items-center gap-2">
                  <div className="w-1 h-1 bg-orange-500 rounded-full" /> Transcription Hint (Keywords for accuracy)
                </label>
                <textarea 
                  value={transcriptionHint} 
                  onChange={(e) => setTranscriptionHint(e.target.value)}
                  placeholder="例：Kindle, 出版, 印税, カテゴリー, 著者名, 専門用語..." 
                  className="neon-input text-xs h-20 pt-3" 
                  style={{ borderColor: 'rgba(255,165,0,0.2)' }} 
                />
                <p className="text-[9px] text-slate-500 italic">※AIに関連用語を教えることで、誤字を減らします。</p>
              </div>
            </div>
          )}

          {/* 2. リライト要件管理 */}
          {activeTab === 'rules' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                <p className="text-xs text-slate-400 leading-relaxed">
                  コンテンツに応じて、以下の要件を追加した上でリライトしてください。
                  <br />
                  <span className="text-cyan-400/80 font-bold uppercase tracking-wider">【書籍テーマ】【ターゲット読者】【著者の実績や体験談】</span>
                </p>
              </div>

              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={newRuleText} 
                  onChange={(e) => setNewRuleText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addRule()}
                  placeholder="新しい要件を追加（例：語尾は「〜です」で統一）" 
                  className="neon-input text-xs flex-1"
                />
                <button onClick={addRule} className="btn-neon-blue !p-2.5">
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="grid gap-3">
                {customRules.map((rule) => (
                  <div key={rule.id} className={`group p-4 rounded-2xl border transition-all ${rule.enabled ? 'bg-dark-800/40 border-cyan-500/10' : 'bg-dark-950/20 border-transparent opacity-40'}`}>
                    <div className="flex items-start gap-4">
                      <button onClick={() => setCustomRules(customRules.map(r => r.id === rule.id ? {...r, enabled: !r.enabled} : r))} className={`mt-1 ${rule.enabled ? 'text-yellow-400' : 'text-slate-600'}`}>
                        {rule.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <div className="flex-1 text-xs leading-relaxed">
                        {editingRuleId === rule.id ? (
                          <div className="flex gap-2">
                            <textarea autoFocus value={editingRuleText} onChange={(e) => setEditingRuleText(e.target.value)} className="w-full bg-white text-black p-3 rounded-xl outline-none font-sans" rows={2} />
                            <button onClick={() => { setCustomRules(customRules.map(r => r.id === editingRuleId ? {...r, text: editingRuleText} : r)); setEditingRuleId(null); }} className="text-green-400 self-end p-2 hover:bg-green-400/10 rounded-lg"><Check className="w-5 h-5" /></button>
                          </div>
                        ) : (
                          <span className={rule.enabled ? 'text-slate-200' : 'text-slate-500 line-through'}>{rule.text}</span>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingRuleId(rule.id); setEditingRuleText(rule.text); }} className="p-2 hover:text-cyan-400 text-slate-500"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setCustomRules(customRules.filter(r => r.id !== rule.id))} className="p-2 hover:text-pink-500 text-slate-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. 構成パターン管理 */}
          {activeTab === 'patterns' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-dark-800/40 p-6 rounded-2xl border border-white/5 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500/60">New Pattern Template</p>
                <div className="grid gap-4">
                  <input type="text" value={newPatternName} onChange={(e) => setNewPatternName(e.target.value)} placeholder="パターン名（例：Q&A形式）" className="neon-input text-xs" />
                  <textarea value={newPatternText} onChange={(e) => setNewPatternText(e.target.value)} placeholder="具体的な構成指示を入力..." className="neon-input text-xs h-24 pt-3" />
                  <button onClick={addPattern} className="btn-neon-green self-end">
                    <Plus className="w-4 h-4" /> テンプレートを追加
                  </button>
                </div>
              </div>

              <div className="grid gap-4">
                {structurePatterns.map((pattern) => (
                  <div key={pattern.id} className="group p-5 rounded-2xl border border-white/5 bg-dark-900/40 hover:bg-dark-800/60 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        {editingPatternId === pattern.id ? (
                          <input autoFocus value={editingPatternName} onChange={(e) => setEditingPatternName(e.target.value)} className="bg-dark-950 border border-cyan-500/30 rounded px-2 py-1 text-sm text-cyan-400 font-bold outline-none mb-2" />
                        ) : (
                          <h4 className="text-sm font-bold text-cyan-400 tracking-wide">{pattern.name}</h4>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {editingPatternId === pattern.id ? (
                          <button onClick={() => { setStructurePatterns(structurePatterns.map(p => p.id === editingPatternId ? {...p, name: editingPatternName, text: editingPatternText} : p)); setEditingPatternId(null); }} className="text-green-400 p-2 hover:bg-green-400/10 rounded-lg"><Check className="w-5 h-5" /></button>
                        ) : (
                          <>
                            <button onClick={() => { setEditingPatternId(pattern.id); setEditingPatternName(pattern.name); setEditingPatternText(pattern.text); }} className="p-2 hover:text-cyan-400 text-slate-500"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => setStructurePatterns(structurePatterns.filter(p => p.id !== pattern.id))} className="p-2 hover:text-pink-500 text-slate-500"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </div>
                    {editingPatternId === pattern.id ? (
                      <textarea value={editingPatternText} onChange={(e) => setEditingPatternText(e.target.value)} className="w-full bg-white text-black p-4 rounded-xl text-xs font-sans outline-none" rows={4} />
                    ) : (
                      <p className="text-xs text-slate-400 leading-relaxed italic border-l-2 border-cyan-500/20 pl-4">{pattern.text}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 flex items-center justify-between bg-dark-900/50" style={{ borderTop: '1px solid rgba(0,245,255,0.1)' }}>
          <p className="text-[10px] text-slate-600 font-mono italic">Sync local storage: OK</p>
          <button onClick={handleSave} className={saved ? 'btn-neon-green' : 'btn-neon-cyan'}>
            {saved ? <><CheckCircle2 className="w-5 h-4" />Saved Successfully</> : 'Apply All Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
