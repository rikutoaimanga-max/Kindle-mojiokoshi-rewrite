import React, { useState, useEffect } from 'react';
import { Settings, BookOpen, AlertCircle, Wand2, FileText, Loader2, Download, BookMarked, FileDown, Zap, Mic, PenLine, Trash2, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import Uploader from './components/Uploader';
import ResultPreview from './components/ResultPreview';
import { transcribeAudio } from './services/openai';
import { rewriteWithClaude } from './services/anthropic';
import { downloadAsEpub } from './services/epub';
import { downloadAsDocx } from './services/word';

const STORAGE_KEY = 'kindle_editor_settings';

// 入力モード: 'audio' | 'text'
const INPUT_MODES = [
  { id: 'audio', label: '音声アップロード', icon: Mic,     color: '#00f5ff', rgb: '0,245,255' },
  { id: 'text',  label: 'テキスト入力',     icon: PenLine, color: '#bf5fff', rgb: '191,95,255' },
];

function App() {
  const [settings, setSettings] = useState({ 
    openaiKey: '', 
    anthropicKey: '', 
    authorName: '', 
    customInstructions: '', 
    customRules: [],
    structurePatterns: [],
    transcriptionHint: ''
  });
  const [selectedPatternId, setSelectedPatternId] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 入力モード
  const [inputMode, setInputMode] = useState('audio');
  const [directText, setDirectText] = useState('');

  // 文字起こし
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeStatus, setTranscribeStatus] = useState('');
  const [transcribedText, setTranscribedText] = useState('');

  // リライト
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewrittenText, setRewrittenText] = useState('');
  
  // AI推奨
  const [recommendation, setRecommendation] = useState({ patternId: null, reason: '', isLoading: false });

  // 表示タブ
  const [activeTab, setActiveTab] = useState('transcribed');

  // エクスポート
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [bookTitle, setBookTitle] = useState('');

  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      
      // ── マイグレーション ───────────────────────
      if (parsed.customInstructions && (!parsed.customRules || parsed.customRules.length === 0)) {
        parsed.customRules = [{
          id: 'initial_migration_' + Date.now(),
          text: parsed.customInstructions,
          enabled: true
        }];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
      
      // ── パターン初期プリセット ────────────────
      if (!parsed.structurePatterns || parsed.structurePatterns.length === 0) {
        parsed.structurePatterns = [
          { id: 'p1', name: '標準的な構成', text: '内容を論理的にまとめ、魅力的な「##（H2）」または「###（H3）」の見出しを自動生成して章立てします。', icon: 'Book' },
          { id: 'p2', name: 'ハウツー・手順書', text: 'ステップバイステップで手順を説明し、番号付きリストを多用して実践しやすい構成にします。', icon: 'ListOrdered' },
          { id: 'p3', name: '対談・インタビュー', text: '話者を明示し、対話の空気感を残しつつ、要点を整理して読みやすく構成します。', icon: 'MessagesSquare' }
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
      
      setSettings(parsed);
      if (!selectedPatternId && parsed.structurePatterns.length > 0) {
        setSelectedPatternId(parsed.structurePatterns[0].id);
      }
    } else {
      setIsSettingsOpen(true);
    }
  }, []);

  const handleSaveSettings = (s) => {
    setSettings(s);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  };

  const handleModeSwitch = (mode) => {
    setInputMode(mode);
    setTranscribedText('');
    setRewrittenText('');
    setError('');
    setRecommendation({ patternId: null, reason: '', isLoading: false });
  };

  // ── AI推奨の実行 ────────────────────────────
  const handleRecommendation = async (text) => {
    if (!settings.anthropicKey) return;
    setRecommendation(prev => ({ ...prev, isLoading: true, reason: '' }));
    try {
      const { recommendPattern } = await import('./services/anthropic');
      const result = await recommendPattern(text, settings.anthropicKey, settings.structurePatterns);
      if (result) {
        setRecommendation({
          patternId: result.recommendedPatternId,
          reason: result.reason,
          isLoading: false
        });
        setSelectedPatternId(result.recommendedPatternId);
      }
    } catch (err) {
      setRecommendation(prev => ({ ...prev, isLoading: false }));
    }
  };

  // ── 音声アップロード ──────────────────────────
  const handleUpload = async (file) => {
    if (!settings.openaiKey) { setIsSettingsOpen(true); setError('OpenAI APIキーを設定してください。'); return; }
    setError(''); setIsTranscribing(true); setTranscribeProgress(0); setTranscribeStatus('準備中...');
    setTranscribedText(''); setRewrittenText(''); setActiveTab('transcribed');
    try {
      const text = await transcribeAudio(file, settings.openaiKey, (p, status) => {
        setTranscribeProgress(p);
        if (status) setTranscribeStatus(status);
      }, settings.transcriptionHint);
      setTranscribedText(text);
      if (text) handleRecommendation(text);
    } catch (err) { setError(err.message || 'エラーが発生しました。'); }
    finally { setIsTranscribing(false); }
  };

  // ── テキスト直接送信 ──────────────────────────
  const handleDirectTextSubmit = () => {
    if (!directText.trim()) { setError('テキストを入力してください。'); return; }
    setError('');
    setTranscribedText(directText.trim());
    setRewrittenText('');
    setActiveTab('transcribed');
    handleRecommendation(directText.trim());
  };

  // ── AIリライト ──────────────────────────────
  const handleRewrite = async () => {
    if (!settings.anthropicKey) { setIsSettingsOpen(true); setError('Anthropic APIキーを設定してください。'); return; }
    if (!transcribedText) return;
    setError(''); setIsRewriting(true); setRewrittenText('');
    
    const activeRules = settings.customRules
      ? settings.customRules.filter(r => r.enabled).map(r => r.text).join('\n')
      : (settings.customInstructions || '');
      
    const selectedPattern = settings.structurePatterns?.find(p => p.id === selectedPatternId);
    const patternText = selectedPattern ? selectedPattern.text : '';

    try {
      const result = await rewriteWithClaude(transcribedText, settings.anthropicKey, activeRules, patternText);
      setRewrittenText(result); setActiveTab('rewritten');
    } catch (err) { setError(err.message || 'リライト中にエラーが発生しました。'); }
    finally { setIsRewriting(false); }
  };

  // ── EPUB ──────────────────────────────────
  const handleExportEpub = async () => {
    const text = rewrittenText || transcribedText;
    if (!text) return;
    setError(''); setIsExporting(true);
    try { await downloadAsEpub(text, bookTitle || `Kindle原稿_${new Date().toLocaleDateString('ja-JP')}`, settings.authorName || '著者名'); }
    catch (err) { setError(err.message || 'EPUBの生成に失敗しました。'); }
    finally { setIsExporting(false); }
  };

  // ── Word ──────────────────────────────────
  const handleExportDocx = async () => {
    const text = rewrittenText || transcribedText;
    if (!text) return;
    setError(''); setIsExportingDocx(true);
    try { await downloadAsDocx(text, bookTitle || `Kindle原稿_${new Date().toLocaleDateString('ja-JP')}`, settings.authorName || '著者名'); }
    catch (err) { setError(err.message || 'Wordファイルの生成に失敗しました。'); }
    finally { setIsExportingDocx(false); }
  };

  const currentText = activeTab === 'rewritten' ? rewrittenText : transcribedText;
  const step1Done = !!transcribedText;
  const step2Done = !!rewrittenText;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#05050f' }}>

      {/* ── Header ────────────────────────────── */}
      <header className="sticky top-0 z-40" style={{ background: 'rgba(5,5,15,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,245,255,0.1)' }}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative p-2 rounded-xl" style={{ background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.3)', boxShadow: '0 0 16px rgba(0,245,255,0.2)' }}>
              <BookOpen className="w-5 h-5" style={{ color: '#00f5ff', filter: 'drop-shadow(0 0 6px rgba(0,245,255,0.8))' }} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none" style={{ background: 'linear-gradient(90deg, #00f5ff, #bf5fff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Kindle Editor AI
              </h1>
              <p className="text-xs mt-0.5 font-mono" style={{ color: 'rgba(0,245,255,0.5)' }}>音声 / テキスト → リライト → EPUB</p>
            </div>
          </div>
          <button onClick={() => setIsSettingsOpen(true)} className="btn-ghost flex items-center gap-2 text-xs">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline tracking-wide">設定</span>
          </button>
        </div>
      </header>

      {/* ── Main ─────────────────────────────── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
        <div className="space-y-8">

          {/* Hero */}
          <div className="text-center space-y-5 mb-10">
            <div className="relative flex justify-center">
              <div className="absolute -top-8 w-64 h-32 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: 'linear-gradient(135deg, #00f5ff, #bf5fff)' }} />
              <h2 className="relative text-4xl font-black tracking-tight leading-tight">
                <span style={{ background: 'linear-gradient(135deg, #00f5ff 0%, #bf5fff 50%, #ff2d9b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Kindle原稿を
                </span>
                <br />
                <span className="text-slate-200">AIで自動生成する</span>
              </h2>
            </div>
            <p className="text-slate-500 text-sm max-w-xl mx-auto leading-relaxed">
              音声またはテキストを入力 → Claudeでプロ品質にリライト → EPUB / Wordでダウンロード
            </p>

            {/* Step badges */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {[
                { label: '① 入力',         done: step1Done, color: '#00f5ff', shadow: 'rgba(0,245,255,0.3)' },
                { label: '② AIリライト',   done: step2Done, color: '#bf5fff', shadow: 'rgba(191,95,255,0.3)' },
                { label: '③ ダウンロード', done: false,     color: '#00ff88', shadow: 'rgba(0,255,136,0.3)' },
              ].map((step, i) => (
                <React.Fragment key={step.label}>
                  <span className="text-xs px-3 py-1.5 rounded-full font-mono font-medium transition-all"
                    style={{
                      color: step.done ? step.color : 'rgba(148,163,184,0.5)',
                      background: step.done ? `rgba(${step.color === '#00f5ff' ? '0,245,255' : step.color === '#bf5fff' ? '191,95,255' : '0,255,136'},0.1)` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${step.done ? step.color + '55' : 'rgba(255,255,255,0.06)'}`,
                      boxShadow: step.done ? `0 0 8px ${step.shadow}` : 'none',
                    }}>
                    {step.label}
                  </span>
                  {i < 2 && <span style={{ color: 'rgba(0,245,255,0.2)' }} className="text-xs">›</span>}
                </React.Fragment>
              ))}
            </div>

            {/* Active Rules Indicator */}
            {(settings.customRules?.filter(r => r.enabled).length > 0) && (
              <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase font-bold tracking-widest" style={{ color: 'rgba(191,95,255,0.6)' }}>
                <Zap className="w-3 h-3" />
                <span>{settings.customRules.filter(r => r.enabled).length} 個のカスタム要件が適用中</span>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center space-x-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(255,45,155,0.08)', border: '1px solid rgba(255,45,155,0.3)', color: '#ff6bb3' }}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── 入力モード切り替えタブ ────────────── */}
          {!transcribedText && (
            <div className="glass-card rounded-2xl overflow-hidden" style={{ borderColor: 'rgba(0,245,255,0.12)' }}>
              <div className="flex" style={{ borderBottom: '1px solid rgba(0,245,255,0.08)' }}>
                {INPUT_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const active = inputMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => handleModeSwitch(mode.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold tracking-wide transition-all"
                      style={{
                        background: active ? `rgba(${mode.rgb},0.12)` : 'transparent',
                        color: active ? mode.color : 'rgba(148,163,184,0.5)',
                        borderBottom: active ? `2px solid ${mode.color}` : '2px solid transparent',
                      }}
                    >
                      <Icon className="w-4 h-4" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>
              <div className="p-6 sm:p-8">
                {inputMode === 'audio' ? (
                  <Uploader onUpload={handleUpload} isLoading={isTranscribing} progress={transcribeProgress} status={transcribeStatus} />
                ) : (
                  <div className="space-y-4">
                    <textarea
                      value={directText}
                      onChange={(e) => setDirectText(e.target.value)}
                      placeholder="ここにテキストを貼り付けてください..."
                      rows={10}
                      className="w-full rounded-xl outline-none text-sm leading-relaxed p-4 transition-all"
                      style={{ background: 'rgba(5,5,15,0.6)', border: '1px solid rgba(191,95,255,0.2)', color: '#e2e8f0' }}
                    />
                    <div className="flex justify-end">
                      <button onClick={handleDirectTextSubmit} disabled={!directText.trim()} className="btn-neon-purple">
                        <Zap className="w-4 h-4" />次へ進む
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Result Area */}
          {(transcribedText || rewrittenText) && (
            <div className="space-y-6">
              {/* Tabs */}
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveTab('transcribed')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all"
                  style={{
                    background: activeTab === 'transcribed' ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.03)',
                    border: activeTab === 'transcribed' ? '1px solid rgba(0,245,255,0.5)' : '1px solid rgba(255,255,255,0.06)',
                    color: activeTab === 'transcribed' ? '#00f5ff' : 'rgba(148,163,184,0.6)',
                  }}>
                  <FileText className="w-3.5 h-3.5" />{inputMode === 'text' ? '入力原文' : '文字起こし'}
                </button>
                {rewrittenText && (
                  <button onClick={() => setActiveTab('rewritten')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all"
                    style={{
                      background: activeTab === 'rewritten' ? 'rgba(191,95,255,0.15)' : 'rgba(255,255,255,0.03)',
                      border: activeTab === 'rewritten' ? '1px solid rgba(191,95,255,0.5)' : '1px solid rgba(255,255,255,0.06)',
                      color: activeTab === 'rewritten' ? '#bf5fff' : 'rgba(148,163,184,0.6)',
                    }}>
                    <Wand2 className="w-3.5 h-3.5" />AIリライト済み
                  </button>
                )}
              </div>

              <ResultPreview text={currentText} />

              {/* 構成案・再提出 (未リライト時のみ) */}
              {transcribedText && !rewrittenText && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-green-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-green-400">構成パターンを選択</span>
                    </div>
                    {recommendation.isLoading && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" /> AIが内容に基づき推奨を分析中...
                      </div>
                    )}
                  </div>

                  {recommendation.reason && (
                    <div className="p-4 rounded-xl border border-dashed" style={{ background: 'rgba(0,255,136,0.03)', borderColor: 'rgba(0,255,136,0.2)' }}>
                      <div className="flex items-start gap-3">
                        <Zap className="w-4 h-4 mt-0.5 text-green-400" />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-green-400 mb-1">AI推奨の根拠</p>
                          <p className="text-xs text-slate-300 leading-relaxed italic">{recommendation.reason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {settings.structurePatterns?.map((p) => (
                      <button key={p.id} onClick={() => setSelectedPatternId(p.id)}
                        className="glass-card text-left p-4 rounded-xl transition-all relative overflow-hidden"
                        style={{
                          borderColor: selectedPatternId === p.id ? 'rgba(0,255,136,0.6)' : 'rgba(255,255,255,0.06)',
                          background: selectedPatternId === p.id ? 'rgba(0,255,136,0.08)' : 'rgba(5,5,15,0.4)',
                        }}>
                        {selectedPatternId === p.id && <CheckCircle2 className="absolute top-2 right-2 w-3 h-3 text-green-400" />}
                        <h4 className={`text-sm font-bold mb-1 ${selectedPatternId === p.id ? 'text-green-400' : 'text-slate-200'}`}>{p.name}</h4>
                        <p className="text-[10px] text-slate-500 line-clamp-2">{p.text}</p>
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-center pt-4">
                    <button onClick={handleRewrite} disabled={isRewriting} className="btn-neon-purple w-full max-w-md py-4">
                      {isRewriting ? <><Loader2 className="w-5 h-5 animate-spin" />リライト中...</> : <><Zap className="w-5 h-5" />② AIリライトを実行</>}
                    </button>
                  </div>
                </div>
              )}

              {/* リライト済み後のアクション */}
              {rewrittenText && (
                <div className="space-y-8 animate-in fade-in duration-700">
                  <div className="flex justify-start">
                    <button onClick={() => { setRewrittenText(''); setActiveTab('transcribed'); }} className="btn-ghost text-xs">
                      <Trash2 className="w-3 h-3" />やり直す（別の構成を試す）
                    </button>
                  </div>

                  <div className="glass-card p-6 rounded-2xl space-y-6" style={{ borderColor: 'rgba(0,255,136,0.15)' }}>
                    <div className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-green-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-green-400">完成原稿の保存</span>
                    </div>
                    <input type="text" value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} placeholder="書籍タイトル（ファイル名）" className="neon-input" />
                    <div className="flex flex-wrap gap-3">
                      <button onClick={handleExportEpub} disabled={isExporting} className="btn-neon-green flex-1 py-4">
                        <Download className="w-4 h-4" />EPUB形式<span className="text-[10px] ml-1 opacity-60">KDP申請用</span>
                      </button>
                      <button onClick={handleExportDocx} disabled={isExportingDocx} className="btn-neon-blue flex-1 py-4">
                        <FileDown className="w-4 h-4" />Word形式<span className="text-[10px] ml-1 opacity-60">推敲・編集用</span>
                      </button>
                    </div>

                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.1)' }}>
                      <BookMarked className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                      <div className="text-[11px] text-slate-400 leading-relaxed">
                        <span className="text-green-400 font-bold">KDPへの申請：</span>
                        ダウンロードしたEPUBファイルを、Amazon KDPの「電子書籍の原稿」セクションにアップロードしてください。
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {isSettingsOpen && (
        <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}

export default App;
