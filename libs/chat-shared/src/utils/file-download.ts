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

/** Triggers a browser download of `content` as a text file named `filename`. */
export const downloadTextFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
