import { describe, expect, it } from 'vitest';
import { buildPromptId, parsePromptId } from './prompt-mapper.util';

describe('buildPromptId', () => {
  it('builds a full resource id for a root-level prompt', () => {
    expect(buildPromptId('bucket-1', 'greeting')).toBe(
      'prompts/bucket-1/greeting',
    );
  });

  it('builds a full resource id for a prompt nested inside a folder', () => {
    expect(buildPromptId('bucket-1', 'Work/AI/summarize')).toBe(
      'prompts/bucket-1/Work/AI/summarize',
    );
  });

  it('keeps spaces and other reserved characters unencoded, unlike a DIAL SDK call url', () => {
    expect(buildPromptId('bucket-1', 'New folder 1/Prompt 1')).toBe(
      'prompts/bucket-1/New folder 1/Prompt 1',
    );
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

  it('returns null for a different resource prefix', () => {
    expect(parsePromptId('skills/bucket-1/greeting')).toBeNull();
  });

  it('returns null when the bucket segment is missing', () => {
    expect(parsePromptId('prompts/bucket-1')).toBeNull();
  });

  it('returns null when the path segment is empty', () => {
    expect(parsePromptId('prompts/bucket-1/')).toBeNull();
  });

  it('returns null when the bucket segment is empty', () => {
    expect(parsePromptId('prompts//greeting')).toBeNull();
  });
});
