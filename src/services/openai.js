// Whisper APIの1リクエスト上限：25MB
const WHISPER_MAX_BYTES = 24 * 1024 * 1024; // 安全マージンで24MBに設定
// 1チャンクあたりの最大時間（秒）
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

  // PCMデータを書き込む
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
 * チャンクあたりの最大サンプル数を計算
 */
const calcSamplesPerChunk = (audioBuffer) => {
  const { sampleRate, numberOfChannels } = audioBuffer;
  const bytesPerSample = 2;
  const maxSamples = Math.floor(WHISPER_MAX_BYTES / (numberOfChannels * bytesPerSample));
  const maxByTime = CHUNK_SECONDS * sampleRate;
  return Math.min(maxSamples, maxByTime);
};

/**
 * Whisper APIに単一チャンクを送信する
 * @param {Blob} blob - 音声データ
 * @param {string} apiKey - APIキー
 * @param {string} filename - ファイル名
 * @param {string} prompt - 文脈情報・キーワード（文字起こしのヒント）
 */
const transcribeBlob = async (blob, apiKey, filename = 'chunk.wav', prompt = '') => {
  const formData = new FormData();
  formData.append('file', blob, filename);
  formData.append('model', 'whisper-1');
  formData.append('language', 'ja');
  
  // prompt パラメータを追加することで、固有名詞の誤字を減らし、
  // チャンク間に跨る文脈を維持しやすくします。
  if (prompt) {
    formData.append('prompt', prompt);
  }

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
 * メモリ節約型かつ高精度な文字起こし
 */
export const transcribeAudio = async (file, apiKey, onProgress, transcriptionHint = '') => {
  if (onProgress) onProgress(2, 'ファイルを読み込み中...');

  // ── 24MB以下なら直接送信 ──
  if (file.size <= WHISPER_MAX_BYTES) {
    if (onProgress) onProgress(10, 'サーバーへ送信中...');
    return await transcribeBlob(file, apiKey, file.name, transcriptionHint);
  }

  // ── 24MB超：分割処理 ──
  if (onProgress) onProgress(5, '巨大ファイルをスキャン中...');

  let arrayBuffer = await file.arrayBuffer();
  if (onProgress) onProgress(10, 'メモリ節約デコード中...');

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 16000, 
  });

  let audioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    arrayBuffer = null; 
  } catch (err) {
    arrayBuffer = null;
    throw new Error('音声のデコードに失敗しました。');
  }

  const totalSamples = audioBuffer.length;
  const samplesPerChunk = calcSamplesPerChunk(audioBuffer);
  const totalChunks = Math.ceil(totalSamples / samplesPerChunk);

  if (onProgress) onProgress(20, `全 ${totalChunks} 個の区間に分割して解析中...`);

  const texts = [];
  // チャンク間の文脈を維持するため、前のチャンクの結果を次のチャンクの prompt に渡す
  let lastAppendedText = transcriptionHint;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * samplesPerChunk;
    const end = Math.min(start + samplesPerChunk, totalSamples);

    if (onProgress) onProgress(20 + Math.round((i / totalChunks) * 75), `解析中... (${i + 1}/${totalChunks})`);

    const wavBlob = audioBufferSliceToWav(audioBuffer, start, end);
    
    try {
      // 前のチャンクの最後の200文字程度をヒントとして渡す（Whisperのprompt制限に配慮）
      const contextPrompt = (transcriptionHint + " " + lastAppendedText).slice(-1000);
      const chunkText = await transcribeBlob(wavBlob, apiKey, `chunk_${i + 1}.wav`, contextPrompt);
      
      texts.push(chunkText);
      lastAppendedText = chunkText;
    } catch (err) {
      console.error(`Chunk ${i} failed:`, err);
      texts.push(`[解析エラー: ${err.message}]`);
    }
  }

  audioCtx.close();
  if (onProgress) onProgress(100, '完了！');

  return texts.join('\n');
};
