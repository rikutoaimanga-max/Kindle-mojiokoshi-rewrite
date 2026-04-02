import Epub from 'epub-gen-memory';

/**
 * MarkdownテキストをEPUBのHTMLチャプター配列に変換する
 * H2見出しを章（chapter）の区切りとして扱う
 */
const parseMarkdownToChapters = (markdown) => {
  const lines = markdown.split('\n');
  const chapters = [];
  let currentTitle = '';
  let currentContent = [];

  const flushChapter = () => {
    if (currentTitle || currentContent.length > 0) {
      chapters.push({
        title: currentTitle || '本文',
        content: renderContentToHtml(currentContent),
      });
    }
    currentContent = [];
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushChapter();
      currentTitle = line.replace(/^## /, '').trim();
    } else {
      currentContent.push(line);
    }
  }
  flushChapter();

  return chapters.length > 0 ? chapters : [{ title: '本文', content: renderContentToHtml(lines) }];
};

/**
 * Markdown行配列を章内HTMLに変換する
 */
const renderContentToHtml = (lines) => {
  let html = '';
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h3>${trimmed.replace(/^### /, '')}</h3>`;
    } else if (trimmed.startsWith('- ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      // インライン太字
      const liText = trimmed.replace(/^- /, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html += `<li>${liText}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (trimmed === '') {
        html += '<br/>';
      } else {
        const pText = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html += `<p>${pText}</p>`;
      }
    }
  }
  if (inList) html += '</ul>';
  return html;
};

/**
 * リライト済みMarkdownテキストをEPUBファイルとしてダウンロードする
 * @param {string} markdownText  - リライト済みMarkdownテキスト
 * @param {string} bookTitle     - 書籍タイトル
 * @param {string} authorName    - 著者名
 */
export const downloadAsEpub = async (markdownText, bookTitle, authorName) => {
  const chapters = parseMarkdownToChapters(markdownText);

  const options = {
    title: bookTitle || `Kindle原稿_${new Date().toLocaleDateString('ja-JP')}`,
    author: authorName || '著者名',
    publisher: '',
    lang: 'ja',
    tocTitle: '目次',
    content: chapters,
    css: `
      body { font-family: 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif; line-height: 1.8; font-size: 1em; }
      h2 { font-size: 1.4em; font-weight: bold; margin: 1.5em 0 0.5em; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
      h3 { font-size: 1.15em; font-weight: bold; margin: 1.2em 0 0.4em; }
      p  { margin: 0.6em 0; }
      ul { margin: 0.6em 0 0.6em 1.5em; }
      li { margin: 0.3em 0; }
      strong { font-weight: bold; }
    `,
  };

  const epubContent = await Epub(options);
  const blob = new Blob([epubContent], { type: 'application/epub+zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${options.title}.epub`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
