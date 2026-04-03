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
 * サンプル数を計算
 */
const calcSamplesPerChunk = (audioBuffer) => {
  const { sampleRate, numberOfChannels } = audioBuffer;
  const bytesPerSample = 2;
  const maxSamples = Math.floor(WHISPER_MAX_BYTES / (numberOfChannels * bytesPerSample));
  const maxByTime = CHUNK_SECONDS * sampleRate;
  return Math.min(maxSamples, maxByTime);
};

/**
 * 単一チャンクを送信
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
 * メモリ節約型文字起こし
 */
export const transcribeAudio = async (file, apiKey, onProgress) => {
  if (onProgress) onProgress(2, 'ファイルを読み込み中...');

  // ── 24MB以下なら直接送信 ──
  if (file.size <= WHISPER_MAX_BYTES) {
    if (onProgress) onProgress(10, 'サーバーへ送信中...');
    return await transcribeBlob(file, apiKey, file.name);
  }

  // ── 24MB超：メモリ節約モード ──
  if (onProgress) onProgress(5, '巨大ファイルをスキャン中...');

  let arrayBuffer = await file.arrayBuffer();
  if (onProgress) onProgress(15, 'メモリ節約デコードを開始...');

  // 16kHz モノラル（Whisperの推奨値）に制限してデコード
  // これにより、通常のステレオデコードと比較してメモリ消費を大幅に削減
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 16000, // 44.1kHzから16kHzへダウンサンプリング
  });

  let audioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    // デコード完了後、元の巨大な ArrayBuffer は不要なので即座に解放
    arrayBuffer = null; 
  } catch (err) {
    arrayBuffer = null;
    throw new Error('音声のデコードに失敗しました。1.4GBを超える巨大ファイルの場合、ブラウザのメモリ制限により処理できない可能性があります。一度mp3などの軽量な形式に変換してからアップロードしてください。');
  }

  const totalSamples = audioBuffer.length;
  const samplesPerChunk = calcSamplesPerChunk(audioBuffer);
  const totalChunks = Math.ceil(totalSamples / samplesPerChunk);

  if (onProgress) onProgress(20, `計 ${totalChunks} 個のチャンクに分割中...`);

  const texts = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * samplesPerChunk;
    const end = Math.min(start + samplesPerChunk, totalSamples);

    if (onProgress) onProgress(20 + Math.round((i / totalChunks) * 75), `文字起こし中... (${i + 1}/${totalChunks})`);

    // 1チャンクずつ切り出してWAV化し、即時に送信
    const wavBlob = audioBufferSliceToWav(audioBuffer, start, end);
    
    try {
      const chunkText = await transcribeBlob(wavBlob, apiKey, `chunk_${i + 1}.wav`);
      texts.push(chunkText);
    } catch (err) {
      console.error(`Chunk ${i} failed:`, err);
      // 一部のチャンクが失敗しても継続するか、エラーを出すか
      texts.push(`[エラー：この区間の文字起こしに失敗しました (${err.message})]`);
    }

    // 各チャンク処理後、可能であれば一時変数をクリア
    // ただし、audioBufferは全チャンクで共有するためnullにはできない
  }

  audioCtx.close();
  if (onProgress) onProgress(100, '完了！');

  return texts.join('\n');
};
