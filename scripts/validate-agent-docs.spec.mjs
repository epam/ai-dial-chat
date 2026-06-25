// Tests the agent-config validator against fixtures that are intentionally
// broken in exactly one way each, proving the gate actually rejects them (and
// accepts a clean file). Fixtures are written to a throwaway temp dir under
// scripts/ at runtime (not committed); that dir is matched by .prettierignore
// so the validator only exercises the specific structural check under test —
// prettier formatting never fires on a deliberately-malformed fixture.
// Run: npm run validate:agent-docs:test

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(here);
const script = join(here, 'validate-agent-docs.mjs');

// Each fixture is one intentionally-broken (or clean) config file, keyed by the
// relative path the validator keys its checks off (`.claude/skills/.../SKILL.md`,
// `.mcp.json`, etc.). U+200B is the zero-width space the hidden-char check flags.
const FIXTURES = {
  'broken/.claude/skills/bad-yaml/SKILL.md':
    '---\nname: bad-yaml\ndescription: "open quote\nbroken: [unclosed\n---\n\nBody.\n',
  'broken/.claude/skills/unterminated/SKILL.md':
    '---\nname: unterminated\ndescription: no closing fence\n',
  'broken/.claude/skills/missing-name/SKILL.md':
    '---\ndescription: has a description but no name\n---\n\nBody.\n',
  'broken/.claude/rules/hidden-char.md':
    '# Rule\n\nThis line has a hidden​character.\n',
  'broken/.claude/settings.json': '{ "permissions": { "allow": [ }\n',
  'broken/.mcp.json':
    '{\n  "mcpServers": {\n    "demo": {\n      "command": "npx",\n      "args": [\n        "-y",\n        "some-package@latest"\n      ]\n    }\n  }\n}\n',
  'broken/.claude/rules/npx-nx.md': '# Rule\n\nRun `npx nx build app` to build.\n',
  'broken/.claude/skills/dup-a/SKILL.md':
    '---\nname: duplicate-name\ndescription: first skill with this name\n---\n\nBody.\n',
  'broken/.claude/skills/dup-b/SKILL.md':
    '---\nname: duplicate-name\ndescription: second skill with this name\n---\n\nBody.\n',
  // AWS keys and private-key headers never appear as examples, so they are
  // unambiguous. `AKIA` + 16 uppercase/digits is the access-key-id shape.
  'broken/.claude/rules/aws-key.md':
    '# Rule\n\nUse the key `AKIA1234567890ABCDEF` for the upload.\n',
  'broken/.claude/rules/private-key.md':
    '# Rule\n\n```\n-----BEGIN RSA PRIVATE KEY-----\n-----END RSA PRIVATE KEY-----\n```\n',
  // settings.json security: a wildcard Bash grant and the skip-permissions flag
  // each disable the approval gate. Kept on distinct paths so they don't collide
  // with the invalid-JSON fixture's `broken/.claude/settings.json` slot.
  'broken-perms/.claude/settings.json':
    '{ "permissions": { "allow": ["Bash(*)"] } }\n',
  'broken-skip/.claude/settings.json':
    '{ "permissions": { "allow": [] }, "extra": "--dangerously-skip-permissions" }\n',
  // Placeholder credential — MUST pass (proves no false positive on docs).
  'valid/.claude/rules/placeholder-key.md':
    '# Rule\n\nSet your key, e.g. `sk-ant-xxxxxxxxxxxxxxxxxxxx`, in the env.\n',
  'valid/.claude/skills/good/SKILL.md':
    '---\nname: sample-good-skill\ndescription: Minimal valid skill fixture for the validator test suite.\n---\n\nValid body.\n',
};

let fixturesRoot;
const fixture = (relPath) => join(fixturesRoot, relPath);

before(() => {
  // Prefix matches the `scripts/.agent-docs-fixtures*` entry in .prettierignore.
  fixturesRoot = mkdtempSync(join(here, '.agent-docs-fixtures-'));
  for (const [relPath, content] of Object.entries(FIXTURES)) {
    const full = fixture(relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
});

after(() => rmSync(fixturesRoot, { recursive: true, force: true }));

// Always run from the repo root so prettier config / .prettierignore resolve as
// they do in CI. Explicit file args skip the repo-wide breakpoint scan.
const run = (...files) =>
  spawnSync('node', [script, ...files], { cwd: repoRoot, encoding: 'utf8' });

const rejects = (relPath, pattern) => {
  const result = run(fixture(relPath));
  assert.equal(result.status, 1, `expected exit 1 for ${relPath}`);
  assert.match(result.stderr, pattern);
};

test('rejects broken frontmatter YAML', () =>
  rejects('broken/.claude/skills/bad-yaml/SKILL.md', /frontmatter YAML/));

test('rejects an unterminated frontmatter block', () =>
  rejects(
    'broken/.claude/skills/unterminated/SKILL.md',
    /unterminated frontmatter block/,
  ));

test('rejects a skill missing the name key', () =>
  rejects('broken/.claude/skills/missing-name/SKILL.md', /missing `name`/));

test('rejects a hidden/invisible character', () =>
  rejects('broken/.claude/rules/hidden-char.md', /hidden character U\+200B/));

test('rejects invalid JSON', () =>
  rejects('broken/.claude/settings.json', /JSON:/));

test('rejects a floating @latest MCP version', () =>
  rejects('broken/.mcp.json', /floating package version/));

test('rejects `npx nx` usage', () =>
  rejects('broken/.claude/rules/npx-nx.md', /npm exec nx/));

test('rejects duplicate Claude skill names', () => {
  const result = run(
    fixture('broken/.claude/skills/dup-a/SKILL.md'),
    fixture('broken/.claude/skills/dup-b/SKILL.md'),
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicates/);
});

test('rejects a committed AWS access key', () =>
  rejects('broken/.claude/rules/aws-key.md', /AWS access key/));

test('rejects a committed private key', () =>
  rejects('broken/.claude/rules/private-key.md', /private key/));

test('rejects an over-broad permission grant', () =>
  rejects('broken-perms/.claude/settings.json', /wildcard grant/));

test('rejects the --dangerously-skip-permissions flag', () =>
  rejects('broken-skip/.claude/settings.json', /skip-permissions/));

test('accepts a placeholder credential in docs', () => {
  const result = run(fixture('valid/.claude/rules/placeholder-key.md'));
  assert.equal(result.status, 0, result.stderr);
});

test('accepts a valid skill', () => {
  const result = run(fixture('valid/.claude/skills/good/SKILL.md'));
  assert.equal(result.status, 0, result.stderr);
});
