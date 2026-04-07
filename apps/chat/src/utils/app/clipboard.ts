import { sanitize } from 'isomorphic-dompurify';
import markdownToTxt from 'markdown-to-txt';
import { marked } from 'marked';

export const writeTextToClipboard = (
  content: string,
  callback?: () => void,
  options?: { convertFromMarkdown?: boolean },
) => {
  if (options?.convertFromMarkdown) {
    if (navigator.clipboard?.write && window.ClipboardItem) {
      const html = sanitize(marked(content, { async: false }));
      const plainText = markdownToTxt(content);

      const htmlBlob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });

      navigator.clipboard
        .write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
          }),
        ])
        .then(callback);

      return;
    }
    if (navigator.clipboard) {
      console.warn(
        'Clipboard API with HTML support is not available, falling back to markdown copying',
      );
    }
  }
  if (!navigator.clipboard?.writeText) {
    console.error('Clipboard API support is not available');
    return;
  }
  navigator.clipboard.writeText(content).then(callback);
};
