import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sharedPacker = resolve(
  fixtureRoot,
  '../attachment-canvas-consumer-fixture/scripts/pack-and-install.mjs',
);

execFileSync(process.execPath, [sharedPacker], {
  cwd: fixtureRoot,
  env: {
    ...process.env,
    FIXTURE_ROOT_DIR: fixtureRoot,
    FIXTURE_ROOT_PACKAGE:
      '@epam/ai-dial-scheduled-tasks,@epam/ai-dial-catalog',
  },
  stdio: 'inherit',
});
