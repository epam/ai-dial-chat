#!/usr/bin/env node
/*
 * Catches an app re-declaring a value set a lib already exports.
 *
 * A string enum in apps/<app>/src whose members carry exactly the same set of
 * values as a string enum in libs/<lib>/src is a copy: TypeScript string enums
 * are nominal, so the copy does not even type-check against the lib's own
 * signatures and drifts on the lib's next change. Import the lib's enum
 * instead.
 *
 *   ERROR (exit 1)
 *     - An app enum with the same value set as a lib enum (two or more members).
 *     - An allowlist entry without a `reason`.
 *
 *   WARNING (never fails)
 *     - An allowlist entry that no longer matches anything.
 *
 * Not scanned: tests, build output, `apps/chat-api` (the backend legitimately
 * mirrors its own DTO enums) and `libs/chat-api-client` (generated from it).
 *
 * Intentional duplicates go in scripts/lib-duplicates.allow.json:
 *
 *   { "entries": [
 *       { "app": "apps/chat/src/types/foo.ts#FooKind",
 *         "reason": "why this app enum must stay separate" } ] }
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ALLOWLIST = join(ROOT, 'scripts', 'lib-duplicates.allow.json');
const SKIPPED_DIRS = new Set([
  'node_modules',
  'dist',
  'out-tsc',
  'coverage',
  'tests',
  '__tests__',
]);
const SKIPPED_PROJECTS = new Set(['apps/chat-api', 'libs/chat-api-client']);
/*
 * Request/lifecycle words that unrelated state machines share. A value set made
 * only of these (`idle`/`loading`/`ready`/`error`) says nothing about origin,
 * so it is not reported; a set carrying any domain value (`API_KEY`, `SIGNED_IN`) is.
 */
const GENERIC_VALUES = new Set([
  'idle',
  'loading',
  'ready',
  'error',
  'success',
  'failed',
  'failure',
  'pending',
  'resolved',
  'done',
  'active',
  'unavailable',
]);
const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.(spec|test)\.tsx?$/;
const ENUM = /export\s+enum\s+(\w+)\s*\{([^}]*)\}/g;
const STRING_MEMBER = /^\s*\w+\s*=\s*(['"])(.*?)\1\s*$/;

const toPosix = (path) => path.split(sep).join('/');

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return SKIPPED_DIRS.has(name) ? [] : walk(path);
    }
    return SOURCE_FILE.test(name) && !TEST_FILE.test(name) ? [path] : [];
  });

const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/* Returns every exported enum whose members are all string-valued, with its value-set signature. */
const readEnums = (file) => {
  const text = stripComments(readFileSync(file, 'utf8'));
  return [...text.matchAll(ENUM)].flatMap(([, name, body]) => {
    const members = body
      .split(',')
      .map((member) => member.trim())
      .filter(Boolean);
    const values = members.map((member) => STRING_MEMBER.exec(member)?.[2]);
    if (values.length < 2 || values.some((value) => value === undefined)) {
      return [];
    }
    if (values.every((value) => GENERIC_VALUES.has(value.toLowerCase()))) {
      return [];
    }
    return [
      {
        name,
        file: toPosix(relative(ROOT, file)),
        signature: [...values].sort().join('\u0000'),
      },
    ];
  });
};

const collect = (kind) => {
  const base = join(ROOT, kind);
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((project) => !SKIPPED_PROJECTS.has(`${kind}/${project}`))
    .map((project) => join(base, project, 'src'))
    .filter(existsSync)
    .flatMap(walk)
    .flatMap(readEnums);
};

const readAllowlist = () => {
  if (!existsSync(ALLOWLIST)) return [];
  return JSON.parse(readFileSync(ALLOWLIST, 'utf8')).entries ?? [];
};

const main = () => {
  const libEnums = new Map();
  for (const entry of collect('libs')) {
    const list = libEnums.get(entry.signature) ?? [];
    list.push(entry);
    libEnums.set(entry.signature, list);
  }

  const allowlist = readAllowlist();
  const errors = [];
  const usedAllowEntries = new Set();
  for (const entry of allowlist) {
    if (!entry.reason)
      errors.push(`allowlist entry ${entry.app} has no reason`);
  }

  for (const appEnum of collect('apps')) {
    const matches = libEnums.get(appEnum.signature);
    if (!matches) continue;
    const id = `${appEnum.file}#${appEnum.name}`;
    const allowed = allowlist.find((entry) => entry.app === id);
    if (allowed) {
      usedAllowEntries.add(allowed);
      continue;
    }
    const where = matches.map((lib) => `${lib.name} (${lib.file})`).join(', ');
    errors.push(
      `${id} duplicates the value set of ${where} — import the lib enum instead`,
    );
  }

  for (const entry of allowlist) {
    if (!usedAllowEntries.has(entry)) {
      console.warn(
        `warning: allowlist entry ${entry.app} matches nothing — remove it`,
      );
    }
  }

  if (errors.length > 0) {
    errors.forEach((error) => console.error(`error: ${error}`));
    console.error(
      `\nlib duplicates: ${errors.length} error(s). See .claude/rules/apps.md "Reuse before you declare".`,
    );
    process.exit(1);
  }
  console.log('lib duplicates: no app enum re-declares a lib enum.');
};

main();
