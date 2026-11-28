import { describe, expect, it } from 'vitest';
import { buildPromptId, parsePromptId } from './prompt-mapper.util';

describe('buildPromptId', () => {
  it.each([
    [
      'builds a full resource id for a root-level prompt',
      { path: 'greeting', expected: 'prompts/bucket-1/greeting' },
    ],
    [
      'builds a full resource id for a prompt nested inside a folder',
      {
        path: 'Work/AI/summarize',
        expected: 'prompts/bucket-1/Work/AI/summarize',
      },
    ],
    [
      'keeps spaces and other reserved characters unencoded, unlike a DIAL SDK call url',
      {
        path: 'New folder 1/Prompt 1',
        expected: 'prompts/bucket-1/New folder 1/Prompt 1',
      },
    ],
  ])('%s', (_name, { path, expected }) => {
    expect(buildPromptId('bucket-1', path)).toBe(expected);
  });
});

describe('parsePromptId', () => {
  it('splits a root-level prompt id into its bucket and path', () => {
    expect(parsePromptId('prompts/bucket-1/greeting')).toEqual({
      bucket: 'bucket-1',
      path: 'greeting',
    });
  });

  it('splits a nested prompt id into its bucket and full sub-path', () => {
    expect(parsePromptId('prompts/bucket-1/Work/AI/summarize')).toEqual({
      bucket: 'bucket-1',
      path: 'Work/AI/summarize',
    });
  });

  it('round-trips with buildPromptId', () => {
    const id = buildPromptId('owner-bucket', 'Work/AI/rewrite');
    expect(parsePromptId(id)).toEqual({
      bucket: 'owner-bucket',
      path: 'Work/AI/rewrite',
    });
  });

  it.each([
    [
      'returns null for a different resource prefix',
      { id: 'skills/bucket-1/greeting' },
    ],
    [
      'returns null when the bucket segment is missing',
      { id: 'prompts/bucket-1' },
    ],
    [
      'returns null when the path segment is empty',
      { id: 'prompts/bucket-1/' },
    ],
    [
      'returns null when the bucket segment is empty',
      { id: 'prompts//greeting' },
    ],
  ])('%s', (_name, { id }) => {
    expect(parsePromptId(id)).toBeNull();
  });
});
