import { sanitize } from 'isomorphic-dompurify';
import { marked } from 'marked';
import removeMd from 'remove-markdown';

export const writeTextToClipboard = (
  content: string,
  callback?: () => void,
  options?: { convertFromMarkdown?: boolean },
) => {
  if (options?.convertFromMarkdown) {
    if (navigator.clipboard?.write && window.ClipboardItem) {
      const html = sanitize(marked(content, { async: false }));
      const plainText = removeMd(content);

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
