import { describe, expect, it } from 'vitest';
import { parseSkillManifestDocument } from '../skill-manifest';

describe('parseSkillManifestDocument', () => {
  it('splits frontmatter from the body', () => {
    const result = parseSkillManifestDocument(
      '---\nname: Research\ndescription: Finds sources\n---\n\n# Instructions\nDo the thing.',
    );

    expect(result.name).toBe('Research');
    expect(result.description).toBe('Finds sources');
    expect(result.body).toBe('# Instructions\nDo the thing.');
  });

  it('returns the whole file as the body when there is no frontmatter', () => {
    const raw = '# Instructions\nDo the thing.';
    const result = parseSkillManifestDocument(raw);

    expect(result.body).toBe(raw);
    expect(result.name).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.about).toBeUndefined();
  });

  it('returns the whole file as the body when the fence is never closed', () => {
    const raw = '---\nname: Research\n\n# Instructions';
    const result = parseSkillManifestDocument(raw);

    expect(result.body).toBe(raw);
    expect(result.name).toBeUndefined();
  });

  it('returns an empty body for a frontmatter-only manifest', () => {
    const result = parseSkillManifestDocument('---\nname: Research\n---\n');

    expect(result.body).toBe('');
    expect(result.name).toBe('Research');
  });

  it('tolerates a leading BOM and CRLF line endings', () => {
    const result = parseSkillManifestDocument(
      '﻿---\r\nname: Research\r\n---\r\n\r\n# Body\r\n',
    );

    expect(result.name).toBe('Research');
    expect(result.body).toContain('# Body');
  });

  it.each([
    ['snake_case', 'when_to_use', 'allowed_tools'],
    ['kebab-case', 'when-to-use', 'allowed-tools'],
    ['camelCase', 'whenToUse', 'allowedTools'],
  ])('reads %s frontmatter keys', (_label, whenKey, toolsKey) => {
    const result = parseSkillManifestDocument(
      `---\n${whenKey}: For research tasks\n${toolsKey}: [search, fetch]\n---\n\nBody`,
    );

    expect(result.about?.whenToUse).toBe('For research tasks');
    expect(result.about?.allowedTools).toEqual(['search', 'fetch']);
  });

  it('reads a block sequence as a list', () => {
    const result = parseSkillManifestDocument(
      '---\nallowed_tools:\n  - search\n  - fetch\n---\n\nBody',
    );

    expect(result.about?.allowedTools).toEqual(['search', 'fetch']);
  });

  it('promotes a bare string list value to a one-element array', () => {
    const result = parseSkillManifestDocument(
      '---\nallowed_tools: search\n---\n\nBody',
    );

    expect(result.about?.allowedTools).toEqual(['search']);
  });

  it('reads bundled resources and the skill prompt', () => {
    const result = parseSkillManifestDocument(
      '---\nbundled_resources: [scripts/run.py]\nskill_prompt: Follow the steps\n---\n\nBody',
    );

    expect(result.about?.bundledResources).toEqual(['scripts/run.py']);
    expect(result.about?.skillPrompt).toBe('Follow the steps');
  });

  it('drops a wrong-typed value and still resolves the rest', () => {
    const result = parseSkillManifestDocument(
      '---\ndescription:\n  nested: value\nname: Research\n---\n\nBody',
    );

    expect(result.description).toBeUndefined();
    expect(result.name).toBe('Research');
  });

  it('drops an empty string value', () => {
    const result = parseSkillManifestDocument(
      "---\nname: ''\nwhen_to_use: ''\n---\n\nBody",
    );

    expect(result.name).toBeUndefined();
    expect(result.about).toBeUndefined();
  });

  it('drops non-string entries from a list', () => {
    const result = parseSkillManifestDocument(
      '---\nallowed_tools:\n  - search\n  - 42\n  - true\n---\n\nBody',
    );

    expect(result.about?.allowedTools).toEqual(['search']);
  });

  it('ignores unrecognised keys', () => {
    const result = parseSkillManifestDocument(
      '---\nlicense: Apache-2.0\nversion: 3\n---\n\nBody',
    );

    expect(result.about).toBeUndefined();
    expect(result.body).toBe('Body');
  });

  it('leaves about undefined when only name and description resolve', () => {
    const result = parseSkillManifestDocument(
      '---\nname: Research\ndescription: Finds sources\n---\n\nBody',
    );

    expect(result.about).toBeUndefined();
  });

  it('returns the whole input as the body when the YAML is malformed', () => {
    const raw = '---\ndescription: "unbalanced\nname: Research\n---\n\nBody';
    const result = parseSkillManifestDocument(raw);

    expect(result.body).toBe(raw);
    expect(result.name).toBeUndefined();
    expect(result.description).toBeUndefined();
  });

  it('never throws for any string input', () => {
    expect(() => parseSkillManifestDocument('')).not.toThrow();
    expect(() => parseSkillManifestDocument('---')).not.toThrow();
    expect(() => parseSkillManifestDocument('---\n\t- [\n---')).not.toThrow();
  });

  it('returns an empty body for an empty fence with no content after it', () => {
    const result = parseSkillManifestDocument('---\n---');

    expect(result.body).toBe('');
    expect(result.about).toBeUndefined();
  });
});
