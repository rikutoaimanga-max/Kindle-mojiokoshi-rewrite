/**
 * AIによる構成案の推奨を取得する
 */
export const recommendPattern = async (text, apiKey, patterns) => {
  if (!apiKey) throw new Error('APIキーが必要です。');
  if (!text) return null;

  // デスクトップアプリ実行時 (Electron)
  if (window.electronAPI && window.electronAPI.recommendPattern) {
    try {
      return await window.electronAPI.recommendPattern({
        apiKey,
        textSample: text.slice(0, 5000), // 最初の5000文字程度を分析
        patterns
      });
    } catch (err) {
      console.error('IPC Recommendation failed:', err);
      // 推奨に失敗してもメインのリライトはできるよう、エラーは投げずにnullを返す
      return null;
    }
  }

  // ブラウザ環境では、開発用プロキシを通じて分析（Haikuモデルを使用）
  try {
    const prompt = `以下の文字起こしテキストの冒頭を分析し、提供された「構成パターン」の中から最適なものを1つ選び、その理由を説明してください。
返信は必ず以下のJSON形式のみで回答してください：
{
  "recommendedPatternId": "パターンのID",
  "reason": "推奨理由（日本語）"
}

【テキスト】
${text.slice(0, 3000)}

【パターン】
${JSON.stringify(patterns)}`;

    const response = await fetch('/api/anthropic/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const resultText = data.content[0].text;
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (err) {
    return null;
  }
};

/**
 * Claudeを使用してテキストをリライトする
 */
export const rewriteWithClaude = async (text, apiKey, customInstructions = '', structurePattern = '') => {
  if (!apiKey) throw new Error('Anthropic APIキーを設定してください。');

  const systemPrompt = `あなたはKindle出版専門の編集プロデューサーです。
提供された文字起こしテキストやメモを、高品質なKindle書籍原稿へとリライトしてください。

【編集方針】
- 読者が一気に読みたくなるような、リズムの良い魅力的な文章にします。
- 構成パターンに基づき、必要に応じて「##（大見出し）」や「###（小見出し）」を挿入して論理的に構成してください。
- 口述筆記特有の「あのー」「えーと」などの不要な言葉を除去します。
- 読者のベネフィットが明確になるよう整理します。

${structurePattern ? `【今回の構成パターン】\n${structurePattern}\n` : ''}

${customInstructions ? `【追加の編集要件】\n${customInstructions}\n` : ''}

返信は必ずリライト後の本文のみを出力してください。挨拶や説明は不要です。`;

  const userMessage = `以下のテキストを、Kindle書籍の原稿として最高品質にリライトしてください。\n\n${text}`;

  // ── デスクトップアプリ実行時 (CORS回避のためのメインプロセス経由) ──
  if (window.electronAPI) {
    try {
      return await window.electronAPI.rewriteWithClaude({
        apiKey,
        systemPrompt,
        userMessage,
      });
    } catch (err) {
      // メインプロセスから返ってきた具体的なエラーをそのまま投げる
      throw new Error(err.message || 'アプリ内でのリライト処理に失敗しました。');
    }
  }

  // ── ブラウザ環境 (Vite Proxy / Vercelフォールバック) ──
  // 注意: 本番ビルドのアプリでここが呼ばれると「Failed to fetch」になります。
  // window.electronAPI が必ず優先されるようにしています。
  try {
    const response = await fetch('/api/anthropic/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTPエラー: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (err) {
    if (err.message.includes('Failed to fetch')) {
      throw new Error('APIサーバーに接続できませんでした。アプリ版をお使いの場合は、管理者権限での起動またはネットワーク設定を確認してください。');
    }
    throw err;
  }
};
