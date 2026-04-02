// Whisper APIの1リクエスト上限：25MB
const WHISPER_MAX_BYTES = 24 * 1024 * 1024; // 安全マージンで24MBに設定
// 1チャンクあたりの最大時間（秒）— 長い音声の場合これで分割する
const CHUNK_SECONDS = 10 * 60; // 10分

/**
 * AudioBufferの指定範囲を WAV の Blob に変換する
 */
const audioBufferSliceToWav = (audioBuffer, startSample, endSample) => {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numSamples = endSample - startSample;
  const bytesPerSample = 2; // 16-bit PCM
  const dataSize = numSamples * numChannels * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);              // Subchunk1Size
  view.setUint16(20, 1, true);               // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);              // bitsPerSample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // PCMデータを書き込む（インターリーブ）
  let offset = 44;
  for (let i = startSample; i < endSample; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

/**
 * WAV Blobのバイトサイズから推定チャンクサイズを計算
 * 1チャンクが WHISPER_MAX_BYTES を超えないよう分割するサンプル数を返す
 */
const calcSamplesPerChunk = (audioBuffer) => {
  const { sampleRate, numberOfChannels } = audioBuffer;
  const bytesPerSample = 2;
  const maxSamples = Math.floor(WHISPER_MAX_BYTES / (numberOfChannels * bytesPerSample));
  // 時間上限も考慮
  const maxByTime = CHUNK_SECONDS * sampleRate;
  return Math.min(maxSamples, maxByTime);
};

/**
 * Whisper APIに単一チャンクを送信して文字起こし結果を返す
 */
const transcribeBlob = async (blob, apiKey, filename = 'chunk.wav') => {
  const formData = new FormData();
  formData.append('file', blob, filename);
  formData.append('model', 'whisper-1');
  formData.append('language', 'ja');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Whisper APIエラー: ${response.status}`);
  }

  const data = await response.json();
  return data.text || '';
};

/**
 * 音声ファイルを受け取り、必要に応じて自動分割してWhisper APIで文字起こしする。
 * 25MB を超えるファイルはブラウザの Web Audio API でデコード → WAVチャンクに分割して処理。
 *
 * @param {File}     file        - 音声ファイル
 * @param {string}   apiKey      - OpenAI APIキー
 * @param {Function} onProgress  - 進捗コールバック (0〜100)
 * @returns {Promise<string>} 文字起こし結果テキスト
 */
export const transcribeAudio = async (file, apiKey, onProgress) => {
  if (onProgress) onProgress(5);

  // ── 25MB以下なら直接送信 ──────────────────────────
  if (file.size <= WHISPER_MAX_BYTES) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('language', 'ja');

    if (onProgress) onProgress(20);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    });

    if (onProgress) onProgress(90);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || '文字起こしに失敗しました。');
    }

    const data = await response.json();
    if (onProgress) onProgress(100);
    return data.text || '';
  }

  // ── 25MB超：Web Audio APIで分割処理 ──────────────
  if (onProgress) onProgress(5);

  // ArrayBuffer に読み込む
  const arrayBuffer = await file.arrayBuffer();
  if (onProgress) onProgress(15);

  // AudioContextでデコード
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let audioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch {
    throw new Error('音声ファイルのデコードに失敗しました。対応フォーマットか確認してください（mp3, wav, m4a等）。');
  }

  const totalSamples = audioBuffer.length;
  const samplesPerChunk = calcSamplesPerChunk(audioBuffer);
  const totalChunks = Math.ceil(totalSamples / samplesPerChunk);

  if (onProgress) onProgress(20);

  const texts = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * samplesPerChunk;
    const end = Math.min(start + samplesPerChunk, totalSamples);

    // WAV Blobに変換
    const wavBlob = audioBufferSliceToWav(audioBuffer, start, end);

    // Whisper APIに送信
    const chunkText = await transcribeBlob(wavBlob, apiKey, `chunk_${i + 1}.wav`);
    texts.push(chunkText);

    // 進捗更新 (20%〜95%)
    const progress = 20 + Math.round(((i + 1) / totalChunks) * 75);
    if (onProgress) onProgress(progress);
  }

  audioCtx.close();
  if (onProgress) onProgress(100);

  // 結果を結合（チャンク間は改行で区切る）
  return texts.join('\n');
};
