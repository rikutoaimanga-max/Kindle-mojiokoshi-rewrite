import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

// 現在の開発・実行環境に応じたパス設定
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    title: 'Kindle AI Manuscript Editor',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    backgroundColor: '#05050f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // メニューバーを隠す（必要に応じて）
  // win.setMenuBarVisibility(false)

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

// ── Anthropic API へのリクエストをプロキシするハンドラー ──
ipcMain.handle('anthropic:rewrite', async (event, { apiKey, systemPrompt, userMessage }) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192, // リライト用に多めに設定
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
      throw new Error(errorData.error?.message || `Anthropic API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Electron Main Process Rewrite Error:', error);
    // ネットワークエラー (Failed to fetch) の場合、より詳細なメッセージを返す
    if (error.message === 'fetch failed') {
      throw new Error('Anthropic API への接続に失敗しました。インターネット接続を確認してください。');
    }
    throw error;
  }
});

// ── 構成案のレコメンド（分析）用ハンドラー ──
ipcMain.handle('anthropic:recommend', async (event, { apiKey, textSample, patterns }) => {
  try {
    const prompt = `以下の文字起こしテキストの冒頭を分析し、提供された「構成パターン」の中から最適なものを1つ選び、その理由を説明してください。
返信は必ず以下のJSON形式のみで回答してください：
{
  "recommendedPatternId": "パターンのID (例: p1)",
  "reason": "なぜそのパターンを選んだのかの簡潔な理由（日本語）"
}

【文字起こしテキスト（冒頭）】
${textSample.slice(0, 3000)}

【構成パターン候補】
${JSON.stringify(patterns, null, 2)}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022', // 分析用は高速・低価格なHaikuを使用
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Recommendation API Error: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.content[0].text;
    
    // JSONを抽出して解析
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AIの回答から構成案を抽出できませんでした。');
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Electron Main Process Recommend Error:', error);
    throw error;
  }
});
