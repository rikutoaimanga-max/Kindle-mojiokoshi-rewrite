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
    structurePatterns: []  // 構成パターンのリスト
  });
  const [selectedPatternId, setSelectedPatternId] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 入力モード
  const [inputMode, setInputMode] = useState('audio');
  const [directText, setDirectText] = useState('');

  // 文字起こし
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribedText, setTranscribedText] = useState('');

  // リライト
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewrittenText, setRewrittenText] = useState('');

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
      // 以前の customInstructions (string) があり、customRules が空の場合、移行
      if (parsed.customInstructions && (!parsed.customRules || parsed.customRules.length === 0)) {
        parsed.customRules = [{
          id: 'initial_migration_' + Date.now(),
          text: parsed.customInstructions,
          enabled: true
        }];
        // 重複実行を防ぐため元の指示をクリア（オプション：今回はそのまま残してもAPI側で考慮）
        // parsed.customInstructions = ''; 
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

  // モード切り替え時にリセット
  const handleModeSwitch = (mode) => {
    setInputMode(mode);
    setTranscribedText('');
    setRewrittenText('');
    setError('');
  };

  // ── 音声アップロード ──────────────────────────
  const handleUpload = async (file) => {
    if (!settings.openaiKey) { setIsSettingsOpen(true); setError('OpenAI APIキーを設定してください。'); return; }
    setError(''); setIsTranscribing(true); setTranscribeProgress(0);
    setTranscribedText(''); setRewrittenText(''); setActiveTab('transcribed');
    try {
      const text = await transcribeAudio(file, settings.openaiKey, setTranscribeProgress);
      setTranscribedText(text);
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
  };

  // ── AIリライト ──────────────────────────────
  const handleRewrite = async () => {
    if (!settings.anthropicKey) { setIsSettingsOpen(true); setError('Anthropic APIキーを設定してください。'); return; }
    if (!transcribedText) return;
    setError(''); setIsRewriting(true); setRewrittenText('');
    
    // 有効な要件のみを抽出して結合
    const activeRules = settings.customRules
      ? settings.customRules.filter(r => r.enabled).map(r => r.text).join('\n')
      : (settings.customInstructions || '');
      
    // 選択されたパターンの取得
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
          <div className="glass-card rounded-2xl overflow-hidden" style={{ borderColor: 'rgba(0,245,255,0.12)' }}>
            {/* タブヘッダー */}
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
                      boxShadow: active ? `inset 0 -1px 0 ${mode.color}` : 'none',
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {mode.label}
                  </button>
                );
              })}
            </div>

            {/* タブコンテンツ */}
            <div className="p-6 sm:p-8">
              {inputMode === 'audio' ? (
                <Uploader onUpload={handleUpload} isLoading={isTranscribing} progress={transcribeProgress} />
              ) : (
                /* テキスト入力モード */
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#bf5fff' }}>
                      リライトしたいテキストを貼り付け・入力
                    </p>
                    {directText && (
                      <button
                        onClick={() => setDirectText('')}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all"
                        style={{ color: 'rgba(148,163,184,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <Trash2 className="w-3 h-3" />クリア
                      </button>
                    )}
                  </div>
                  <textarea
                    value={directText}
                    onChange={(e) => setDirectText(e.target.value)}
                    placeholder={`ここにテキストを貼り付けてください。\n\n例：\n・ブログ記事の下書き\n・別の書籍からのメモ\n・セミナーの資料文章\n・インタビュー記録\n\nどんなテキストでもKindle用にリライトします。`}
                    rows={10}
                    className="w-full rounded-xl outline-none text-sm leading-relaxed resize-y transition-all"
                    style={{
                      background: 'rgba(5,5,15,0.6)',
                      border: '1px solid rgba(191,95,255,0.2)',
                      color: '#e2e8f0',
                      padding: '1rem',
                      fontFamily: 'inherit',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(191,95,255,0.6)'; e.target.style.boxShadow = '0 0 0 2px rgba(191,95,255,0.1), 0 0 16px rgba(191,95,255,0.15)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(191,95,255,0.2)'; e.target.style.boxShadow = ''; }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono" style={{ color: 'rgba(191,95,255,0.5)' }}>
                      {directText.length.toLocaleString()} 文字
                    </span>
                    <button
                      onClick={handleDirectTextSubmit}
                      disabled={!directText.trim()}
                      className="btn-neon-purple"
                    >
                      <Zap className="w-4 h-4" />
                      このテキストでリライト準備
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── 構成パターン選択 ────────────────── */}
          {transcribedText && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" style={{ color: '#00ff88' }} />
                <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#00ff88' }}>
                  構成パターンを選択
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {settings.structurePatterns?.map((pattern) => (
                  <button
                    key={pattern.id}
                    onClick={() => setSelectedPatternId(pattern.id)}
                    className="glass-card text-left p-4 rounded-xl transition-all relative overflow-hidden group"
                    style={{
                      borderColor: selectedPatternId === pattern.id ? 'rgba(0,255,136,0.6)' : 'rgba(255,255,255,0.06)',
                      background: selectedPatternId === pattern.id ? 'rgba(0,255,136,0.08)' : 'rgba(5,5,15,0.4)',
                      boxShadow: selectedPatternId === pattern.id ? '0 0 15px rgba(0,255,136,0.15)' : 'none',
                    }}
                  >
                    {selectedPatternId === pattern.id && (
                      <div className="absolute top-0 right-0 p-1 bg-green-500/20 rounded-bl-lg">
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                      </div>
                    )}
                    <h4 className={`text-sm font-bold mb-1 transition-colors ${selectedPatternId === pattern.id ? 'text-green-400' : 'text-slate-200'}`}>
                      {pattern.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                      {pattern.text}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Result area */}
          {(transcribedText || rewrittenText) && (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveTab('transcribed')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all"
                  style={{
                    background: activeTab === 'transcribed' ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.03)',
                    border: activeTab === 'transcribed' ? '1px solid rgba(0,245,255,0.5)' : '1px solid rgba(255,255,255,0.06)',
                    color: activeTab === 'transcribed' ? '#00f5ff' : 'rgba(148,163,184,0.6)',
                    boxShadow: activeTab === 'transcribed' ? '0 0 10px rgba(0,245,255,0.2)' : 'none',
                  }}>
                  <FileText className="w-3.5 h-3.5" />
                  {inputMode === 'text' ? '入力テキスト' : '文字起こし'}
                </button>
                {rewrittenText && (
                  <button onClick={() => setActiveTab('rewritten')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all"
                    style={{
                      background: activeTab === 'rewritten' ? 'rgba(191,95,255,0.15)' : 'rgba(255,255,255,0.03)',
                      border: activeTab === 'rewritten' ? '1px solid rgba(191,95,255,0.5)' : '1px solid rgba(255,255,255,0.06)',
                      color: activeTab === 'rewritten' ? '#bf5fff' : 'rgba(148,163,184,0.6)',
                      boxShadow: activeTab === 'rewritten' ? '0 0 10px rgba(191,95,255,0.2)' : 'none',
                    }}>
                    <Wand2 className="w-3.5 h-3.5" />AIリライト済み
                  </button>
                )}
              </div>

              <ResultPreview text={currentText} />

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 items-end">
                {/* First-time rewrite */}
                {transcribedText && !rewrittenText && (
                  <button onClick={handleRewrite} disabled={isRewriting} className="btn-neon-purple">
                    {isRewriting
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Claudeがリライト中...</>
                      : <><Zap className="w-4 h-4" />② AIリライト（Claude）</>}
                  </button>
                )}

                {rewrittenText && (
                  <>
                    <button onClick={handleRewrite} disabled={isRewriting} className="btn-ghost">
                      {isRewriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      {isRewriting ? '処理中...' : '再リライト'}
                    </button>

                    <div className="flex flex-col gap-3 flex-1 min-w-0">
                      <input
                        type="text"
                        value={bookTitle}
                        onChange={(e) => setBookTitle(e.target.value)}
                        placeholder="書籍タイトルを入力（省略可）"
                        className="neon-input"
                        style={{ fontFamily: 'inherit' }}
                      />
                      <div className="flex flex-wrap gap-3">
                        <button onClick={handleExportEpub} disabled={isExporting || isExportingDocx} className="btn-neon-green">
                          {isExporting
                            ? <><Loader2 className="w-4 h-4 animate-spin" />生成中...</>
                            : <><Download className="w-4 h-4" />③ EPUBダウンロード<span className="text-xs ml-1 opacity-60">KDP申請用</span></>}
                        </button>
                        <button onClick={handleExportDocx} disabled={isExporting || isExportingDocx} className="btn-neon-blue">
                          {isExportingDocx
                            ? <><Loader2 className="w-4 h-4 animate-spin" />生成中...</>
                            : <><FileDown className="w-4 h-4" />Word(.docx)<span className="text-xs ml-1 opacity-60">編集用</span></>}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* KDP info */}
              {rewrittenText && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.15)' }}>
                  <BookMarked className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#00ff88' }} />
                  <div className="text-xs text-slate-500">
                    <span style={{ color: '#00ff88' }} className="font-semibold">KDPへの申請：</span>
                    EPUBをダウンロード後、
                    <a href="https://kdp.amazon.co.jp/" target="_blank" rel="noreferrer" className="underline ml-1" style={{ color: '#00ff88' }}>
                      kdp.amazon.co.jp
                    </a>
                    {' '}にログインして「新しいタイトルを作成」からアップロード。
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
