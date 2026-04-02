/**
 * Google Identity Services (GIS) を使ってOAuthアクセストークンを取得する
 * @param {string} clientId - Google Cloud OAuthクライアントID
 * @returns {Promise<string>} アクセストークン
 */
export const getGoogleAccessToken = (clientId) => {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Servicesが読み込まれていません。ページを再読み込みしてください。'));
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response) => {
        if (response.error) {
          reject(new Error(`Google認証エラー: ${response.error}`));
        } else {
          resolve(response.access_token);
        }
      },
    });

    client.requestAccessToken();
  });
};

/**
 * MarkdownテキストをGoogle Docsとして保存する
 * Google Drive API v3 の multipart upload を使用してHTMLをGoogle Docsに変換保存
 * @param {string} markdownText - 保存するMarkdownテキスト
 * @param {string} accessToken - Googleアクセストークン
 * @param {string} title - ドキュメントタイトル
 * @returns {Promise<string>} 作成されたGoogle Docsの共有URL
 */
export const saveToGoogleDocs = async (markdownText, accessToken, title) => {
  // MarkdownをHTMLに変換（Google DriveがGoogle Docsに自動変換）
  const htmlContent = convertMarkdownToHtml(markdownText);

  const metadata = {
    name: title || `Kindle原稿_${new Date().toLocaleDateString('ja-JP')}`,
    mimeType: 'application/vnd.google-apps.document',
  };

  // multipart/related フォームでHTMLをアップロード
  const boundary = '-------kindle_editor_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: text/html; charset=UTF-8\r\n\r\n' +
    htmlContent +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: multipartBody,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Google Drive APIエラー: ${response.status}`
    );
  }

  const data = await response.json();
  const docId = data.id;
  return `https://docs.google.com/document/d/${docId}/edit`;
};

/**
 * 簡易的なMarkdown→HTML変換
 */
const convertMarkdownToHtml = (md) => {
  let html = md
    // H2見出し
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    // H3見出し
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // 太字
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 箇条書き（連続するリストをulでまとめる）
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // 空行を段落区切りに
    .replace(/\n{2,}/g, '</p><p>')
    // 改行
    .replace(/\n/g, '<br>');

  // liをulで囲む
  html = html.replace(/(<li>.*?<\/li>)(\s*<li>.*?<\/li>)*/gs, (match) => `<ul>${match}</ul>`);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><p>${html}</p></body></html>`;
};
