import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        // メインプロセス用のエントリポイント
        entry: 'electron/main.js',
      },
      preload: {
        // プリロードスクリプト用のエントリポイント
        input: path.join(__dirname, 'electron/preload.js'),
      },
      // レンダラープロセスの高度な設定を（エラー回避のため）一時的に無効化
      // renderer: {},
    }),
  ],
  server: {
    proxy: {
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
        headers: {
          'anthropic-version': '2023-06-01',
        },
      },
    },
  },
  optimizeDeps: {
    include: ['epub-gen-memory', 'docx', 'file-saver'],
  },
})
