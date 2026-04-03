import { contextBridge, ipcRenderer } from 'electron'

// Web 側から安全に呼び出せるネイティブ API を定義します
contextBridge.exposeInMainWorld('electronAPI', {
  // 必要に応じてメインプロセスとのやり取りを追加します
  // 例: sendMessage: (message) => ipcRenderer.send('message', message)
})

// Node.js のバージョン情報を公開（デバッグ用）
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
})
