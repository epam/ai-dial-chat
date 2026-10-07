/*
 * Unit tests for the pure parts of scripts/validate-spec-references.mjs: span
 * extraction, the historical-sentence rule, path normalization, classification,
 * allowlist matching, and checkSpec against a throwaway repository fixture.
 * Run: npm run validate:specs:test
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkSpec,
  classifySpan,
  extractSpans,
  findAllowlistEntry,
  flattenKeys,
  i18nKeyExists,
  isBuildOutputPath,
  isHistorical,
  normalizePath,
  parseAllowlist,
  specPathReferences,
} from './validate-spec-references.mjs';

const span = (text, lineText = `uses \`${text}\``) => ({
  text,
  line: 1,
  lineText,
  sentence: lineText,
});

test('extractSpans returns inline spans with line numbers, skipping fences', () => {
  const spans = extractSpans(
    [
      'Intro `apps/chat/src/a.ts` and `b`.',
      '',
      '```ts',
      'const x = `apps/ignored.ts`;',
      '```',
      'Double ``a `tick` span`` here.',
    ].join('\n'),
  );
  assert.deepEqual(
    spans.map((s) => [s.text, s.line]),
    [
      ['apps/chat/src/a.ts', 1],
      ['b', 1],
      ['a `tick` span', 6],
    ],
  );
});

test('extractSpans gives each span the sentence around it, across wrapped lines', () => {
  const [first, second] = extractSpans(
    [
      'The helper `apps/chat/src/old.ts` was removed once',
      'it had no callers. The new home is `libs/x/src/new.ts`.',
    ].join('\n'),
  );
  assert.match(first.sentence, /was removed once it had no callers\.$/);
  assert.equal(second.sentence, 'The new home is `libs/x/src/new.ts`.');
});

test('extractSpans treats list items and table rows as separate blocks', () => {
  const spans = extractSpans(
    [
      '- `apps/a.ts` was removed',
      '- `apps/b.ts` stays',
      '| `apps/c.ts` | ok |',
    ].join('\n'),
  );
  assert.deepEqual(
    spans.map((s) => isHistorical(s)),
    [true, false, false],
  );
});

test('isHistorical matches the documented historical and negated words only', () => {
  for (const sentence of [
    'The file `x` was removed.',
    'Previously `x` owned it.',
    'It superseded `x`.',
    'Relocated from `x`.',
    'The former `x` helper.',
    'There is no `x` key.',
    'The `x` module SHALL NOT exist.',
    'It is no longer `x`.',
  ])
    assert.equal(isHistorical({ sentence }), true, sentence);
  for (const sentence of [
    'The hook lives in `x`.',
    'Removable items use `x`.',
    'It SHALL NOT import `x`.',
  ])
    assert.equal(isHistorical({ sentence }), false, sentence);
});

test('normalizePath strips ./, trailing slash, punctuation and line suffixes', () => {
  assert.deepEqual(normalizePath('./apps/chat/src/a.ts'), {
    path: 'apps/chat/src/a.ts',
    hasLineSuffix: false,
    isPattern: false,
  });
  assert.equal(normalizePath('libs/chat-hooks/').path, 'libs/chat-hooks');
  assert.equal(normalizePath('apps/chat/src/a.ts,').path, 'apps/chat/src/a.ts');
  for (const text of [
    'apps/chat/src/a.ts:12',
    'apps/chat/src/a.ts:12:4',
    'apps/chat/src/a.ts:30-38,69-82',
    'apps/chat/src/a.ts#L12',
    'apps/chat/src/a.ts#L12-L20',
  ]) {
    const normalized = normalizePath(text);
    assert.equal(normalized.path, 'apps/chat/src/a.ts', text);
    assert.equal(normalized.hasLineSuffix, true, text);
  }
  assert.equal(
    normalizePath('apps/chat/src/a.ts::fn(x)').path,
    'apps/chat/src/a.ts',
  );
  assert.equal(
    normalizePath('apps/chat/src/a.ts (the hook)').path,
    'apps/chat/src/a.ts',
  );
});

test('isBuildOutputPath skips build and test output that only exists after a build', () => {
  assert.equal(isBuildOutputPath('apps/chat/dist/index.html'), true);
  assert.equal(isBuildOutputPath('libs/*/dist/index.css'), true);
  assert.equal(isBuildOutputPath('libs/chat-hooks/out-tsc/lib'), true);
  assert.equal(isBuildOutputPath('libs/catalog/src/distance.ts'), false);
  assert.equal(isBuildOutputPath('apps/chat/src/index.tsx'), false);
});

test('normalizePath turns placeholders into wildcards and ignores non-repo paths', () => {
  assert.deepEqual(normalizePath('libs/<lib>/package.json'), {
    path: 'libs/*/package.json',
    hasLineSuffix: false,
    isPattern: true,
  });
  assert.equal(
    normalizePath('apps/chat/src/i18n/locales/{lang}.json').path,
    'apps/chat/src/i18n/locales/*.json',
  );
  assert.equal(normalizePath('libs/{a,b}/src').path, 'libs/{a,b}/src');
  assert.equal(
    normalizePath('apps/chat/.../Foo.tsx').path,
    'apps/chat/**/Foo.tsx',
  );
  assert.equal(normalizePath('src/app.ts'), null);
  assert.equal(normalizePath('/api/v1/files'), null);
  assert.equal(normalizePath('@epam/ai-dial-chat-hooks'), null);
});

test('classifySpan recognizes paths, gated i18n keys and identifiers', () => {
  const namespaces = new Set(['chat', 'buttons']);
  assert.equal(
    classifySpan(span('apps/chat/src/a.ts'), namespaces).kind,
    'path',
  );
  assert.deepEqual(
    classifySpan(
      span('chat.send', 'Add the `chat.send` i18n key.'),
      namespaces,
    ),
    { kind: 'i18n', token: 'chat.send' },
  );
  assert.deepEqual(classifySpan(span("t('buttons.ok')"), namespaces), {
    kind: 'i18n',
    token: 'buttons.ok',
  });
  /* No translation context, or an unknown namespace: not an i18n key. */
  assert.equal(
    classifySpan(span('chat.send', 'Config `chat.send`.'), namespaces),
    null,
  );
  assert.equal(
    classifySpan(span('auth.mode', 'The `auth.mode` locale key.'), namespaces),
    null,
  );
  assert.deepEqual(classifySpan(span('useDialFileManager()'), namespaces), {
    kind: 'identifier',
    tokens: ['useDialFileManager'],
  });
  assert.equal(classifySpan(span('true'), namespaces), null);
  assert.equal(classifySpan(span('id'), namespaces), null);
});

test('i18nKeyExists accepts leaves, groups and plural forms', () => {
  const keys = flattenKeys({
    chat: { send: 'Send', group: { a: 'A' }, items_one: '1', items_other: 'n' },
  });
  assert.equal(i18nKeyExists(keys, 'chat.send'), true);
  assert.equal(i18nKeyExists(keys, 'chat.group'), true);
  assert.equal(i18nKeyExists(keys, 'chat.items'), true);
  assert.equal(i18nKeyExists(keys, 'chat.missing'), false);
});

test('parseAllowlist requires a reason and validates spec scope', () => {
  const { entries, errors } = parseAllowlist({
    entries: [
      { reference: 'tools/list', reason: 'MCP method' },
      { reference: 'docs/*', spec: ['skill-*'], reason: 'skill package file' },
      { reference: 'no-reason' },
      { reason: 'no reference' },
      { reference: 'bad-spec', spec: [1], reason: 'x' },
    ],
  });
  assert.equal(entries.length, 2);
  assert.equal(errors.length, 3);
  assert.match(errors[0], /needs a "reason"/);
  assert.deepEqual(parseAllowlist({}).errors.length, 1);
});

test('findAllowlistEntry matches wildcards within the spec scope and marks use', () => {
  const { entries } = parseAllowlist({
    entries: [
      { reference: 'tools/list', reason: 'MCP method' },
      { reference: 'docs/*', spec: 'skill-*', reason: 'skill package file' },
    ],
  });
  assert.ok(findAllowlistEntry(entries, 'any-spec', 'tools/list'));
  assert.ok(findAllowlistEntry(entries, 'skill-editing', 'docs/refs/a.md'));
  assert.equal(findAllowlistEntry(entries, 'catalog', 'docs/a.md'), null);
  assert.deepEqual(
    entries.map((e) => e.used),
    [true, true],
  );
});

let repoRoot;
before(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'spec-refs-'));
  mkdirSync(join(repoRoot, 'apps/chat/src/hooks'), { recursive: true });
  writeFileSync(
    join(repoRoot, 'apps/chat/src/hooks/useThing.ts'),
    'export const useThing = 1;\n',
  );
});
after(() => rmSync(repoRoot, { recursive: true, force: true }));

test('checkSpec reports missing paths and keys as errors, the rest as warnings', () => {
  const { entries: allowlist } = parseAllowlist({
    entries: [{ reference: 'tools/call', reason: 'MCP method' }],
  });
  const markdown = [
    'The hook `apps/chat/src/hooks/useThing` lives here.',
    'See `apps/chat/src/hooks/useThing.ts:3` for details.',
    'It calls `apps/chat/src/hooks/missing.ts`.',
    'The old `apps/chat/src/gone.ts` file was removed.',
    'Patterns like `apps/chat/src/hooks/*.ts` match, `apps/none/**` does not.',
    'Use the `chat.missing` i18n key and `chat.send` translation key.',
    'Calls `tools/call` and `useThing` and `useNowhere`.',
  ].join('\n');
  const findings = checkSpec(
    { capability: 'demo', file: 'openspec/specs/demo/spec.md', markdown },
    {
      repoRoot,
      i18nKeys: new Set(['chat.send']),
      i18nNamespaces: new Set(['chat']),
      identifiers: new Set(['useThing']),
      allowlist,
    },
  );
  const summary = findings.map(
    (f) => `${f.severity}:${f.kind}:${f.token}:${f.line}`,
  );
  assert.deepEqual(summary, [
    'warning:line-number:apps/chat/src/hooks/useThing.ts:3:2',
    'error:path:apps/chat/src/hooks/missing.ts:3',
    'error:path:apps/none/**:5',
    'error:i18n:chat.missing:6',
    'warning:identifier:useNowhere:7',
  ]);
});

test('specPathReferences dedupes paths and skips historical sentences', () => {
  const refs = specPathReferences(
    [
      '`apps/chat/src/a.ts` and `apps/chat/src/a.ts:4` again.',
      'The `apps/chat/src/old.ts` helper was removed.',
      '`libs/x/` is a directory.',
    ].join('\n'),
  );
  assert.deepEqual(
    refs.map((r) => r.path),
    ['apps/chat/src/a.ts', 'libs/x'],
  );
});
