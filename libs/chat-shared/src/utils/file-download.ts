/** Maps a fenced-code-block language identifier to a file extension (without the leading dot). */
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  typescript: 'ts',
  ts: 'ts',
  tsx: 'tsx',
  javascript: 'js',
  js: 'js',
  jsx: 'jsx',
  python: 'py',
  py: 'py',
  java: 'java',
  csharp: 'cs',
  cs: 'cs',
  cpp: 'cpp',
  c: 'c',
  go: 'go',
  rust: 'rs',
  rs: 'rs',
  ruby: 'rb',
  rb: 'rb',
  php: 'php',
  html: 'html',
  css: 'css',
  scss: 'scss',
  json: 'json',
  yaml: 'yaml',
  yml: 'yml',
  markdown: 'md',
  md: 'md',
  sql: 'sql',
  bash: 'sh',
  sh: 'sh',
  shell: 'sh',
  xml: 'xml',
  kotlin: 'kt',
  swift: 'swift',
  dart: 'dart',
  plaintext: 'txt',
  text: 'txt',
};

/** Returns the file extension (without a leading dot) for a fenced-code-block language identifier, defaulting to `txt`. */
export const getFileExtensionForLanguage = (language: string): string =>
  LANGUAGE_EXTENSIONS[language.toLowerCase()] ?? 'txt';

/**
 * Delay before a triggered download's temporary artifacts (the anchor node, the
 * object URL) are released. Browsers start the download asynchronously after the
 * synthetic click, so releasing them in the same task cancels it.
 */
const DOWNLOAD_CLEANUP_DELAY_MS = 1000;

/** Creates a temporary anchor element and clicks it to trigger a browser download for `href`. */
export const triggerAnchorDownload = (href: string, filename: string): void => {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  /* The anchor must be in the document: a detached one is ignored by Firefox
   * and Safari, which drops the download without any error. */
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => anchor.remove(), DOWNLOAD_CLEANUP_DELAY_MS);
};

/** Triggers a browser download of `blob`, using a temporary object URL that is revoked afterward. */
export const triggerBlobDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  triggerAnchorDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_CLEANUP_DELAY_MS);
};

/** Decodes a base64 string into raw bytes, or `undefined` if the string is not valid base64. */
export const tryBase64ToBytes = (base64: string): Uint8Array | undefined => {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return undefined;
  }
};

/** Decodes an inline `data` payload into a `Blob` of `mimeType`, treating the payload as raw UTF-8 text when it is not valid base64. */
export const base64ToBlob = (data: string, mimeType: string): Blob => {
  const bytes = tryBase64ToBytes(data) ?? new TextEncoder().encode(data);
  return new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
};

/** Triggers a browser download of `content` as a text file named `filename`. */
export const downloadTextFile = (content: string, filename: string): void => {
  triggerBlobDownload(
    new Blob([content], { type: 'text/plain;charset=utf-8' }),
    filename,
  );
};
