import { contextBridge, ipcRenderer } from 'electron'

// Web 側から安全に呼び出せるネイティブ API を定義します
contextBridge.exposeInMainWorld('electronAPI', {
  // メインプロセスで定義したリライト処理を呼び出す
  rewriteWithClaude: (args) => ipcRenderer.invoke('anthropic:rewrite', args),
  recommendPattern: (args) => ipcRenderer.invoke('anthropic:recommend', args),
})

// Node.js のバージョン情報を公開（デバッグ用）
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
})
