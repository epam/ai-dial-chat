type languageMap = Record<string, string | undefined>;

export const languageExtensionMapping: languageMap = {
  javascript: '.js',
  python: '.py',
  java: '.java',
  c: '.c',
  cpp: '.cpp',
  'c++': '.cpp',
  'c#': '.cs',
  ruby: '.rb',
  php: '.php',
  swift: '.swift',
  'objective-c': '.m',
  kotlin: '.kt',
  typescript: '.ts',
  go: '.go',
  perl: '.pl',
  rust: '.rs',
  scala: '.scala',
  haskell: '.hs',
  lua: '.lua',
  shell: '.sh',
  sql: '.sql',
  html: '.html',
  css: '.css',
  bash: '.bash',
  // add more file extensions here, make sure the key is same as language prop in CodeBlock.tsx component
};

export const languageNameMapping: languageMap = {
  sh: 'shell',
};
