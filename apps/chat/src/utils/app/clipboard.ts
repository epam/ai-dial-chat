import { marked } from 'marked';

export const writeTextToClipboard = (
  content: string,
  callback?: () => void,
  options?: { convertFromMarkdown?: boolean },
) => {
  if (options?.convertFromMarkdown) {
    if (!navigator.clipboard?.write || !window.ClipboardItem) return;

    const html = marked(content, { async: false });

    const htmlBlob = new Blob([html], { type: 'text/html' });
    const textBlob = new Blob([content], { type: 'text/plain' });

    navigator.clipboard
      .write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ])
      .then(callback);
  } else {
    navigator.clipboard?.writeText?.(content).then(callback);
  }
};
