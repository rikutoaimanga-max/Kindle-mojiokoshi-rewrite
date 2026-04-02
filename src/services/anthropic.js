import { buildSystemPrompt } from '../prompts/kindleRules';

/**
 * Claude Sonnet を使って文字起こしテキストをKindle用にリライトする
 * Viteのプロキシ(/api/anthropic)経由でCORSを回避して呼び出す
 *
 * @param {string} transcribedText    - 文字起こしテキスト
 * @param {string} apiKey             - Anthropic APIキー
 * @param {string} customInstructions - 設定画面から入力された追加ルール（省略可）
 */
export const rewriteWithClaude = async (transcribedText, apiKey, customInstructions = '', patternText = '') => {
  const systemPrompt = buildSystemPrompt(customInstructions, patternText);

  const response = await fetch('/api/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `以下の音声書き起こしテキストをKindle文章術ルールに従ってリライトしてください。\n\n---\n${transcribedText}\n---`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `APIエラー: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
};
