/*
 * Unit tests for the pure parts of scripts/spec-impact.mjs: glob matching,
 * the too-broad / hub reference filters, spec-update detection, impact
 * ranking, and the plain / annotation / step-summary output.
 * Run: npm run validate:specs:test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMatchers,
  computeImpact,
  escapeAnnotation,
  formatAnnotations,
  formatPlain,
  formatSummary,
  globToRegExp,
  hubReferences,
  literalSegments,
  parseArgs,
  specUpdated,
} from './spec-impact.mjs';
import { normalizePath } from './validate-spec-references.mjs';

const refs = (...paths) => paths.map(normalizePath);

test('globToRegExp handles *, **, ? and {a,b}, and matches beneath directories', () => {
  assert.ok(globToRegExp('libs/*/src').test('libs/chat-hooks/src/index.ts'));
  assert.ok(!globToRegExp('libs/*.ts').test('libs/a/b.ts'));
  assert.ok(
    globToRegExp('apps/chat/src/**/*.spec.tsx').test(
      'apps/chat/src/a/b/c.spec.tsx',
    ),
  );
  assert.ok(
    globToRegExp('apps/chat/src/**/*.spec.tsx').test(
      'apps/chat/src/c.spec.tsx',
    ),
  );
  assert.ok(globToRegExp('libs/{a,b}/x.ts').test('libs/b/x.ts'));
  assert.ok(!globToRegExp('libs/{a,b}/x.ts').test('libs/c/x.ts'));
  assert.ok(globToRegExp('libs/a?.ts').test('libs/ab.ts'));
});

test('literalSegments counts segments before the first wildcard', () => {
  assert.equal(literalSegments('apps/chat/src/a.ts'), 4);
  assert.equal(literalSegments('libs/*/package.json'), 1);
  assert.equal(literalSegments('apps/chat/src/**'), 3);
});

test('buildMatchers drops broad directories, openspec/ and hubs, keeps files', () => {
  const matchers = buildMatchers(
    refs(
      'apps/chat',
      'apps/chat/src/**',
      'openspec/specs/x/spec.md',
      'docs/architecture.md',
      'apps/chat/src/hooks/files',
      'apps/chat/src/i18n/locales/en.json',
      'apps/chat/src/hooks/useThing',
    ),
    new Set(['apps/chat/src/i18n/locales/en.json']),
  );
  assert.deepEqual(
    matchers.map((m) => m.reference),
    [
      'docs/architecture.md',
      'apps/chat/src/hooks/files',
      'apps/chat/src/hooks/useThing',
    ],
  );
  const [file, directory, module] = matchers;
  assert.ok(file.test('docs/architecture.md'));
  assert.ok(!file.test('docs/architecture.md.bak'));
  assert.ok(directory.test('apps/chat/src/hooks/files/useX.ts'));
  assert.ok(!directory.test('apps/chat/src/hooks/files-other/useX.ts'));
  assert.ok(module.test('apps/chat/src/hooks/useThing.ts'));
  assert.ok(module.test('apps/chat/src/hooks/useThing/index.ts'));
  assert.ok(!module.test('apps/chat/src/hooks/useThingElse.ts'));
});

test('hubReferences returns paths cited by more specs than the threshold', () => {
  const specs = [1, 2, 3].map((n) => ({
    references: refs(
      'apps/chat/src/app/app.tsx',
      ...(n === 1 ? ['libs/x/src/a.ts'] : []),
    ),
  }));
  assert.deepEqual([...hubReferences(specs, 2)], ['apps/chat/src/app/app.tsx']);
});

test('specUpdated accepts the spec itself or a delta spec under openspec/changes', () => {
  assert.ok(specUpdated('cap', ['openspec/specs/cap/spec.md']));
  assert.ok(specUpdated('cap', ['openspec/changes/add-x/specs/cap/spec.md']));
  assert.ok(!specUpdated('cap', ['openspec/specs/cap-other/spec.md']));
  assert.ok(
    !specUpdated('cap', ['openspec/changes/add-x/specs/other-cap/spec.md']),
  );
});

test('computeImpact lists unchanged specs whose references changed, most-changed first', () => {
  const specs = [
    {
      capability: 'alpha',
      file: 'openspec/specs/alpha/spec.md',
      references: refs('libs/chat-hooks/src/files', 'docs/architecture.md'),
    },
    {
      capability: 'beta',
      file: 'openspec/specs/beta/spec.md',
      references: refs('libs/chat-hooks/src/files/a.ts'),
    },
    {
      capability: 'gamma',
      file: 'openspec/specs/gamma/spec.md',
      references: refs('libs/chat-hooks/src/files/a.ts'),
    },
    {
      capability: 'delta',
      file: 'openspec/specs/delta/spec.md',
      references: refs('apps/chat-api/src/themes/theme.service.ts'),
    },
  ];
  const impacts = computeImpact(
    specs,
    [
      'libs/chat-hooks/src/files/a.ts',
      'libs/chat-hooks/src/files/b.ts',
      'docs/architecture.md',
      'openspec/specs/gamma/spec.md',
    ],
    { hubThreshold: 10 },
  );
  assert.deepEqual(
    impacts.map((i) => [i.capability, i.changedFiles.length]),
    [
      ['alpha', 3],
      ['beta', 1],
    ],
  );
  assert.deepEqual(impacts[0].references, [
    'docs/architecture.md',
    'libs/chat-hooks/src/files',
  ]);
});

const sample = [
  {
    capability: 'alpha',
    file: 'openspec/specs/alpha/spec.md',
    changedFiles: ['a.ts', 'b.ts', 'c.ts', 'd|e.ts'],
    references: [],
  },
  {
    capability: 'beta',
    file: 'openspec/specs/beta/spec.md',
    changedFiles: ['a.ts'],
    references: [],
  },
];

test('formatPlain caps the list and says when nothing is impacted', () => {
  const text = formatPlain(sample, {
    base: 'origin/development',
    limit: 1,
    total: 2,
  });
  assert.match(text, /2 spec\(s\).*\(top 1 shown\)/);
  assert.match(
    text,
    /openspec\/specs\/alpha\/spec\.md: 4 changed file\(s\).*\(\+1 more\)/,
  );
  assert.doesNotMatch(text, /beta/);
  assert.match(
    formatPlain([], { base: 'x', limit: 30, total: 0 }),
    /no spec references/,
  );
});

test('formatAnnotations emits one ::warning per spec with an escaped message', () => {
  const lines = formatAnnotations(sample, 30).split('\n');
  assert.equal(lines.length, 2);
  assert.match(
    lines[0],
    /^::warning file=openspec\/specs\/alpha\/spec\.md::Spec may be stale: 4 file/,
  );
  assert.equal(escapeAnnotation('50%\nnext'), '50%25%0Anext');
});

test('formatSummary renders a Markdown table with escaped pipes', () => {
  const summary = formatSummary(sample, { base: 'abc', limit: 30, total: 2 });
  assert.match(summary, /^## Spec impact \(advisory\)/);
  assert.match(summary, /\| Spec \| Changed referenced files \| Examples \|/);
  assert.match(
    summary,
    /\| `openspec\/specs\/alpha\/spec\.md` \| 4 \| .* \+1 more \|/,
  );
  assert.doesNotMatch(summary, /`d\|e\.ts`/);
  assert.match(
    formatSummary([], { base: 'abc', limit: 30, total: 0 }),
    /No spec references/,
  );
});

test('parseArgs reads --base, --base=, --limit and --json with defaults', () => {
  assert.deepEqual(parseArgs([]), {
    base: 'origin/development',
    limit: 30,
    json: false,
  });
  assert.deepEqual(parseArgs(['--base', 'abc123', '--limit', '5', '--json']), {
    base: 'abc123',
    limit: 5,
    json: true,
  });
  assert.equal(parseArgs(['--base=main']).base, 'main');
});
