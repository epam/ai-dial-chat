import assert from 'node:assert/strict';
import { validateScheduledTaskFormValues } from '@epam/ai-dial-scheduled-tasks/validation';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
for (const name of ['scheduled-tasks', 'catalog', 'chat-hooks', 'skills']) {
  const entry = realpathSync(require.resolve('@epam/ai-dial-' + name));
  assert(
    entry.startsWith(realpathSync(resolve(root, 'node_modules'))),
    'Must load an installed tarball: ' + entry,
  );
}
assert.equal(typeof validateScheduledTaskFormValues, 'function');
execFileSync(
  process.execPath,
  [
    require.resolve('typescript/bin/tsc'),
    '-p',
    resolve(root, 'tsconfig.consumer.json'),
  ],
  { stdio: 'inherit' },
);

console.log('PASS packed runtime imports and isolated TypeScript');
