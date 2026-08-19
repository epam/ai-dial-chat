import { describe, expect, it } from 'vitest';
import { PromptFieldError } from '../../types/prompt';
import {
  PROMPT_CONTENT_MAX_LENGTH,
  PROMPT_DESCRIPTION_MAX_LENGTH,
  PROMPT_NAME_MAX_LENGTH,
  buildPromptPath,
  getRemainingCharacters,
  validatePromptContent,
  validatePromptDescription,
  validatePromptName,
} from '../prompt';

describe('validatePromptName', () => {
  it('accepts a name of letters, digits, spaces, and _ . -', () => {
    expect(validatePromptName('My Prompt_v1.2-final')).toBeNull();
  });

  it('rejects an empty or whitespace-only name', () => {
    expect(validatePromptName('')).toBe(PromptFieldError.Required);
    expect(validatePromptName('   ')).toBe(PromptFieldError.Required);
  });

  it('rejects a name containing a slash', () => {
    expect(validatePromptName('Work/summarize')).toBe(
      PromptFieldError.InvalidName,
    );
  });

  it('rejects the traversal names . and ..', () => {
    expect(validatePromptName('.')).toBe(PromptFieldError.InvalidName);
    expect(validatePromptName('..')).toBe(PromptFieldError.InvalidName);
  });

  it('rejects characters outside the backend allowlist', () => {
    expect(validatePromptName('summarize!')).toBe(PromptFieldError.InvalidName);
  });

  it('rejects a name over the backend length limit', () => {
    expect(validatePromptName('a'.repeat(PROMPT_NAME_MAX_LENGTH))).toBeNull();
    expect(validatePromptName('a'.repeat(PROMPT_NAME_MAX_LENGTH + 1))).toBe(
      PromptFieldError.TooLong,
    );
  });
});

describe('validatePromptDescription', () => {
  it('accepts an empty description', () => {
    expect(validatePromptDescription('')).toBeNull();
  });

  it('rejects a description over the backend length limit', () => {
    expect(
      validatePromptDescription('a'.repeat(PROMPT_DESCRIPTION_MAX_LENGTH)),
    ).toBeNull();
    expect(
      validatePromptDescription('a'.repeat(PROMPT_DESCRIPTION_MAX_LENGTH + 1)),
    ).toBe(PromptFieldError.TooLong);
  });
});

describe('validatePromptContent', () => {
  it('requires a non-empty body', () => {
    expect(validatePromptContent('   ')).toBe(PromptFieldError.Required);
  });

  it('rejects a body over the backend length limit', () => {
    expect(
      validatePromptContent('a'.repeat(PROMPT_CONTENT_MAX_LENGTH)),
    ).toBeNull();
    expect(
      validatePromptContent('a'.repeat(PROMPT_CONTENT_MAX_LENGTH + 1)),
    ).toBe(PromptFieldError.TooLong);
  });
});

describe('getRemainingCharacters', () => {
  it('returns null while far from the limit, so nothing is announced', () => {
    expect(getRemainingCharacters('a'.repeat(100), 50000)).toBeNull();
  });

  it('returns the remaining count within the announce threshold', () => {
    expect(getRemainingCharacters('a'.repeat(49995), 50000)).toBe(5);
    expect(getRemainingCharacters('a'.repeat(50000), 50000)).toBe(0);
  });
});

describe('buildPromptPath', () => {
  it('returns the bare name for a root-level prompt', () => {
    expect(buildPromptPath('', 'summarize')).toBe('summarize');
  });

  it('joins the folder path and the name', () => {
    expect(buildPromptPath('Work/AI', 'summarize')).toBe('Work/AI/summarize');
  });
});
