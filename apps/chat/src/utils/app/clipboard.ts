import { marked } from 'marked';
import removeMd from 'remove-markdown';

export const writeTextToClipboard = (
  content: string,
  callback?: () => void,
  options?: { convertFromMarkdown?: boolean },
) => {
  if (options?.convertFromMarkdown) {
    if (!navigator.clipboard?.write || !window.ClipboardItem) return;

    const html = marked(content, { async: false });
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
  } else {
    navigator.clipboard?.writeText?.(content).then(callback);
  }
};
