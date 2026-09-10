import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import {
  auditResolvedOrigins,
  measureBuild,
  writeAppShellHtml,
} from './application-mode.mjs';
import { cleanupDir } from './harness.mjs';
const keepFixtures = process.env.KEEP_FIXTURES === '1';
const tmpRoot = mkdtempSync(
  path.join(os.tmpdir(), 'ai-dial-chat-application-mode-unit-'),
);
after(() => {
  if (!keepFixtures) cleanupDir(tmpRoot);
});
test('auditResolvedOrigins passes when every module resolves inside the fixture', () => {
  const workspaceRoot = 'C:/chat_copy/ai-dial-chat';
  const fixtureDir = 'C:/temp/fixture-1';
  const measured = {
    initialModuleOrigins: [
      `${fixtureDir}/entry.ts`,
      `${fixtureDir}/node_modules/@epam/ai-dial-chat-hooks/dist/index.js`,
      `${fixtureDir}/node_modules/react/index.js`,
    ],
  };
  const result = auditResolvedOrigins({ measured, workspaceRoot, fixtureDir });
  assert.equal(result.pass, true);
  assert.deepEqual(result.violations, []);
});
test('auditResolvedOrigins fails on a workspace libs/*/src fallback', () => {
  const workspaceRoot = 'C:/chat_copy/ai-dial-chat';
  const fixtureDir = 'C:/temp/fixture-2';
  const measured = {
    initialModuleOrigins: [
      `${fixtureDir}/entry.ts`,
      `${fixtureDir}/node_modules/@epam/ai-dial-chat-hooks/dist/index.js`,
      `${workspaceRoot}/libs/chat-hooks/src/index.ts`,
    ],
  };
  const result = auditResolvedOrigins({ measured, workspaceRoot, fixtureDir });
  assert.equal(result.pass, false);
  assert.deepEqual(result.violations, [
    `${workspaceRoot}/libs/chat-hooks/src/index.ts`,
  ]);
});
test('auditResolvedOrigins fails on a hoisted workspace node_modules fallback', () => {
  const workspaceRoot = 'C:/chat_copy/ai-dial-chat';
  const fixtureDir = 'C:/temp/fixture-3';
  const measured = {
    initialModuleOrigins: [
      `${fixtureDir}/entry.ts`,
      `${workspaceRoot}/node_modules/react/index.js`,
    ],
  };
  const result = auditResolvedOrigins({ measured, workspaceRoot, fixtureDir });
  assert.equal(result.pass, false);
  assert.deepEqual(result.violations, [
    `${workspaceRoot}/node_modules/react/index.js`,
  ]);
});
test('writeAppShellHtml references the manifest entry chunk and its stylesheets', () => {
  const outDir = path.join(tmpRoot, 'shell-fixture');
  mkdirSync(path.join(outDir, '.vite'), { recursive: true });
  writeFileSync(
    path.join(outDir, '.vite', 'manifest.json'),
    JSON.stringify({
      'entry.ts': {
        file: 'assets/entry-ABCDEF.js',
        css: ['assets/entry-ABCDEF.css'],
        isEntry: true,
      },
    }),
  );
  writeAppShellHtml(outDir);
  const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(
    html,
    /<script type="module" src="\/assets\/entry-ABCDEF\.js"><\/script>/,
  );
  assert.match(
    html,
    /<link rel="stylesheet" href="\/assets\/entry-ABCDEF\.css">/,
  );
});

test('origin audit rejects other checkouts, sibling prefixes and unknown virtual modules', () => {
  const origins = [
    'C:/other-checkout/libs/a.js',
    'C:/temp/fixture/node_modules-old/a.js',
    '\0unknown-plugin',
  ];
  assert.deepEqual(
    auditResolvedOrigins({
      fixtureDir: 'C:/temp/fixture',
      measured: { initialModuleOrigins: origins },
    }).violations,
    origins,
  );
});
test('static dependency CSS is linked and missing provenance fails closed', () => {
  const dir = path.join(tmpRoot, 'closure');
  mkdirSync(path.join(dir, '.vite'), { recursive: true });
  writeFileSync(
    path.join(dir, '.vite/manifest.json'),
    JSON.stringify({
      'entry.ts': { file: 'entry.js', isEntry: true, imports: ['shared'] },
      shared: { file: 'shared.js', css: ['shared.css'] },
    }),
  );
  for (const file of ['entry.js', 'shared.js', 'shared.css'])
    writeFileSync(path.join(dir, file), '/* fixture */');
  writeAppShellHtml(dir);
  assert.match(
    readFileSync(path.join(dir, 'index.html'), 'utf8'),
    /href="\/shared.css"/,
  );
  assert.throws(() => measureBuild(dir), /module-origins/);
  writeFileSync(
    path.join(dir, 'module-origins.json'),
    JSON.stringify({ 'entry.js': { 'entry.ts': 1 } }),
  );
  assert.throws(() => measureBuild(dir), /Missing module origins/);
});
