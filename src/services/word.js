import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  NumberFormat,
} from 'docx';
import { saveAs } from 'file-saver';

/**
 * Markdown行をdocxのParagraphノードに変換する
 */
const parseMarkdownToDocxNodes = (markdown) => {
  const lines = markdown.split('\n');
  const paragraphs = [];
  let listBuffer = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    listBuffer.forEach((item) => {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: parseInlineMarkdown(item),
          spacing: { after: 60 },
        })
      );
    });
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('## ')) {
      flushList();
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^## /, '').trim(),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 120 },
        })
      );
    } else if (line.startsWith('### ')) {
      flushList();
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^### /, '').trim(),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 80 },
        })
      );
    } else if (line.startsWith('- ')) {
      listBuffer.push(line.replace(/^- /, '').trim());
    } else if (line === '') {
      flushList();
      paragraphs.push(new Paragraph({ text: '', spacing: { after: 80 } }));
    } else {
      flushList();
      paragraphs.push(
        new Paragraph({
          children: parseInlineMarkdown(line),
          spacing: { after: 120 },
        })
      );
    }
  }
  flushList();
  return paragraphs;
};

/**
 * **太字** と通常テキストを TextRun に変換
 */
const parseInlineMarkdown = (text) => {
  const runs = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index) }));
    }
    runs.push(new TextRun({ text: match[1], bold: true }));
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex) }));
  }
  return runs.length > 0 ? runs : [new TextRun({ text })];
};

/**
 * リライト済みMarkdownをWord(.docx)としてダウンロードする
 */
export const downloadAsDocx = async (markdownText, bookTitle, authorName) => {
  const title = bookTitle || `Kindle原稿_${new Date().toLocaleDateString('ja-JP')}`;

  const titleParagraph = new Paragraph({
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 52, // 26pt
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
  });

  const authorParagraph = new Paragraph({
    children: [
      new TextRun({
        text: authorName || '著者名',
        size: 28, // 14pt
        color: '666666',
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 480 },
  });

  const bodyNodes = parseMarkdownToDocxNodes(markdownText);

  const doc = new Document({
    creator: authorName || '著者名',
    title,
    description: 'Kindle Editor AIで生成されたKindle原稿',
    styles: {
      default: {
        document: {
          run: {
            size: 24, // 12pt
            font: 'MS Mincho',
          },
          paragraph: {
            spacing: { line: 360 }, // 1.5行間隔
          },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          run: { size: 36, bold: true, color: '1E3A8A' },
          paragraph: {
            spacing: { before: 360, after: 120 },
          },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          run: { size: 28, bold: true, color: '1D4ED8' },
          paragraph: {
            spacing: { before: 240, after: 80 },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 }, // A5相当マージン
          },
        },
        children: [titleParagraph, authorParagraph, ...bodyNodes],
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
  saveAs(buffer, `${safeTitle}.docx`);
};
