import React, { useCallback, useState } from 'react';
import { UploadCloud, FileAudio, Loader2 } from 'lucide-react';

export default function Uploader({ onUpload, isLoading, progress, status }) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragActive(false);
    if (e.dataTransfer.files?.[0]) onUpload(e.dataTransfer.files[0]);
  }, [onUpload]);
  const handleChange = (e) => { if (e.target.files?.[0]) onUpload(e.target.files[0]); };

  return (
    <div
      className={`relative w-full rounded-2xl flex flex-col items-center justify-center p-12 text-center overflow-hidden transition-all duration-300 ${isLoading ? 'pointer-events-none' : 'cursor-pointer'}`}
      style={{
        background: isDragActive
          ? 'rgba(0,245,255,0.06)'
          : 'rgba(10,10,26,0.5)',
        border: isDragActive
          ? '2px dashed rgba(0,245,255,0.7)'
          : '2px dashed rgba(0,245,255,0.2)',
        boxShadow: isDragActive ? '0 0 30px rgba(0,245,255,0.15), inset 0 0 30px rgba(0,245,255,0.05)' : 'none',
        transform: isDragActive ? 'scale(1.01)' : 'scale(1)',
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="audio/*,.m4a,.mp3,.mp4,.mpeg,.mpga,.wav,.webm"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        onChange={handleChange}
        disabled={isLoading}
      />

      {isLoading ? (
        <div className="flex flex-col items-center space-y-5">
          {/* Animated scanner */}
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 animate-pulse" style={{ borderColor: 'rgba(0,245,255,0.3)' }} />
            <div className="absolute inset-2 rounded-full border-2 animate-ping" style={{ borderColor: 'rgba(0,245,255,0.2)' }} />
            <div className="flex items-center justify-center w-full h-full">
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#00f5ff' }} />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-wide neon-text-cyan">{status || '文字起こし中...'}</h3>
            <p className="text-xs text-slate-500 mt-1">巨大ファイルの場合はダウンサンプリングしてメモリを節約します</p>
          </div>
          {/* Progress bar */}
          <div className="w-64 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,245,255,0.1)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #00f5ff, #bf5fff)',
                boxShadow: '0 0 8px rgba(0,245,255,0.6)',
              }}
            />
          </div>
          <span className="text-xs font-mono" style={{ color: '#00f5ff' }}>{progress}%</span>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-5">
          <div className="relative animate-float">
            <div className="absolute inset-0 rounded-full blur-xl" style={{ background: 'rgba(0,245,255,0.15)' }} />
            <div className="relative p-5 rounded-2xl" style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.2)' }}>
              <UploadCloud className="w-10 h-10" style={{ color: '#00f5ff', filter: 'drop-shadow(0 0 8px rgba(0,245,255,0.6))' }} />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-wide neon-text-cyan">音声ファイルをアップロード</h3>
            <p className="text-sm text-slate-500">クリックまたはドラッグ＆ドロップ</p>
          </div>
          <div className="flex items-center space-x-2 text-xs px-4 py-2 rounded-full font-mono"
            style={{ background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.15)', color: 'rgba(0,245,255,0.7)' }}>
            <FileAudio className="w-3.5 h-3.5" />
            <span>mp3 / wav / m4a — 制限なし（25MB超は自動分割）</span>
          </div>
        </div>
      )}
    </div>
  );
}
