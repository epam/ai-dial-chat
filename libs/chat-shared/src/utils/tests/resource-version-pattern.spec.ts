import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RESOURCE_VERSION_PATTERN,
  STORED_RESOURCE_VERSION_PATTERN,
} from '../resource-version';

const findRepoRoot = (): string => {
  let directory = process.cwd();
  while (!existsSync(join(directory, 'nx.json'))) {
    const parent = dirname(directory);
    if (parent === directory) throw new Error('Repository root not found');
    directory = parent;
  }
  return directory;
};

const VALIDATORS_DIRECTORY = join(
  findRepoRoot(),
  'apps/chat-api/src/common/validators',
);

const readValidatorSource = (fileName: string): string =>
  readFileSync(join(VALIDATORS_DIRECTORY, fileName), 'utf8');

/* The API file is the single source of the corpus: its two array literals are evaluated here. */
const readCorpusList = (name: string): string[] => {
  const match = new RegExp(
    `export const ${name}: readonly string\\[\\] = (\\[[\\s\\S]*?\\n\\]);`,
  ).exec(readValidatorSource('resource-version.corpus.ts'));
  if (!match) throw new Error(`${name} not found in the API corpus`);
  return new Function(`return ${match[1]}`)() as string[];
};

const ACCEPTED = readCorpusList('ACCEPTED_RESOURCE_VERSIONS');
const REJECTED = readCorpusList('REJECTED_RESOURCE_VERSIONS');
const ACCEPTED_STORED = readCorpusList('ACCEPTED_STORED_RESOURCE_VERSIONS');
const REJECTED_STORED = readCorpusList('REJECTED_STORED_RESOURCE_VERSIONS');

describe('RESOURCE_VERSION_PATTERN', () => {
  it('has the same source as the API constant', () => {
    const match = /export const RESOURCE_VERSION_PATTERN = \/(.*)\/;/.exec(
      readValidatorSource('resource-version.pattern.ts'),
    );
    expect(match).not.toBeNull();
    expect(RESOURCE_VERSION_PATTERN.source).toBe(match?.[1]);
    expect(RESOURCE_VERSION_PATTERN.flags).toBe('');
  });

  it('reads a non-empty corpus from the API', () => {
    expect(ACCEPTED.length).toBeGreaterThan(5);
    expect(REJECTED.length).toBeGreaterThan(10);
  });

  it.each(ACCEPTED)('accepts %j', (version) => {
    expect(RESOURCE_VERSION_PATTERN.test(version)).toBe(true);
  });

  it.each(REJECTED)('rejects %j', (version) => {
    expect(RESOURCE_VERSION_PATTERN.test(version)).toBe(false);
  });
});

describe('STORED_RESOURCE_VERSION_PATTERN', () => {
  it('has the same source as the API constant', () => {
    const match =
      /export const STORED_RESOURCE_VERSION_PATTERN = \/(.*)\/;/.exec(
        readValidatorSource('resource-version.pattern.ts'),
      );
    expect(match).not.toBeNull();
    expect(STORED_RESOURCE_VERSION_PATTERN.source).toBe(match?.[1]);
    expect(STORED_RESOURCE_VERSION_PATTERN.flags).toBe('');
  });

  it.each(ACCEPTED_STORED)('accepts %j', (version) => {
    expect(STORED_RESOURCE_VERSION_PATTERN.test(version)).toBe(true);
  });

  it.each(REJECTED_STORED)('rejects %j', (version) => {
    expect(STORED_RESOURCE_VERSION_PATTERN.test(version)).toBe(false);
  });

  it('accepts everything the strict rule accepts', () => {
    for (const version of ACCEPTED) {
      expect(STORED_RESOURCE_VERSION_PATTERN.test(version)).toBe(true);
    }
  });
});
