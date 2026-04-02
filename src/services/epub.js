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
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      flushChapter();
      currentTitle = trimmed.replace(/^## /, '').trim();
    } else {
      currentContent.push(line);
    }
  }
  flushChapter();

  // 章が1つもない場合は全体を1つの章にする
  const finalChapters = chapters.length > 0 ? chapters : [{ title: '本文', content: renderContentToHtml(lines) }];

  // --- HTML目次ページの作成 ---
  // Kindleでは論理目次（端末機能）に加えて、巻頭のHTML目次ページが推奨されます。
  if (finalChapters.length > 1) {
    let tocHtml = '<div class="toc-page"><h2>目次</h2><ul>';
    finalChapters.forEach((ch, index) => {
      // epub-gen-memoryの内部的なリンク構造に合わせる（通常は各章が独立したファイルになる）
      // ただし、外部からファイル名を指定しにくいため、ここではタイトルのリスト表示に留めるか、
      // ツール側の自動生成目次に任せるのが安全な場合もあります。
      // 今回は「巻頭に目次がある」という体裁を整えるためリストとして出力します。
      tocHtml += `<li class="toc-item">${ch.title}</li>`;
    });
    tocHtml += '</ul></div>';

    // 巻頭に挿入
    finalChapters.unshift({
      title: '目次',
      content: tocHtml,
      excludeFromToc: false // これ自体も目次に含める
    });
  }

  return finalChapters;
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
      // インライン装飾（太字）
      const liText = trimmed.replace(/^- /, '')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
      html += `<li>${liText}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (trimmed === '') {
        html += '<p class="spacer"><br/></p>';
      } else {
        // インライン装飾（太字・斜体）
        const pText = trimmed
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>');
        html += `<p>${pText}</p>`;
      }
    }
  }
  if (inList) html += '</ul>';
  return html;
};

/**
 * リライト済みMarkdownテキストをEPUBファイルとしてダウンロードする
 */
export const downloadAsEpub = async (markdownText, bookTitle, authorName) => {
  const chapters = parseMarkdownToChapters(markdownText);

  const options = {
    title: bookTitle || `Kindle原稿_${new Date().toLocaleDateString('ja-JP')}`,
    author: authorName || '著者名',
    publisher: '',
    lang: 'ja',
    tocTitle: '目次', // これがNCX（端末メニューの目次）のタイトルになる
    content: chapters,
    css: `
      body { font-family: 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif; line-height: 1.8; font-size: 1em; color: #333; }
      h2 { font-size: 1.4em; font-weight: bold; margin: 1.5em 0 0.8em; border-bottom: 2px solid #333; padding-bottom: 0.3em; text-align: center; }
      h3 { font-size: 1.15em; font-weight: bold; margin: 1.2em 0 0.5em; border-left: 4px solid #333; padding-left: 0.5em; }
      p  { margin: 0.8em 0; text-align: justify; }
      .spacer { margin: 1em 0; }
      ul { margin: 0.8em 0 0.8em 1.5em; list-style-type: disc; }
      li { margin: 0.4em 0; }
      strong { font-weight: bold; }
      em { font-style: italic; }
      
      /* 目次ページ用のスタイル */
      .toc-page h2 { border-bottom: none; }
      .toc-page ul { list-style-type: none; margin-left: 0; padding-left: 0; }
      .toc-item { border-bottom: 1px solid #eee; padding: 0.5em 0; font-weight: bold; }
    `,
  };

  try {
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
  } catch (error) {
    console.error('EPUB Generation Failed:', error);
    throw error;
  }
};
