const fs = require('fs');
const path = require('path');

const source = path.join(
  __dirname,
  '..',
  'node_modules',
  'monaco-editor',
  'min',
  'vs',
);

const destination = path.join(
  __dirname,
  '..',
  'apps',
  'chat',
  'public',
  'monaco-editor',
);

fs.cpSync(source, destination, {
  recursive: true,
  force: true,
});

console.info('Monaco editor copied successfully.');
