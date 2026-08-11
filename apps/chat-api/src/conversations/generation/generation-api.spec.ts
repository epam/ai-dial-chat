import { describe, expect, it } from 'vitest';
import { GenerationApi, resolveGenerationApi } from './generation-api';

describe('resolveGenerationApi', () => {
  it('resolves to Responses when responsesApi is true', () => {
    expect(resolveGenerationApi({ responsesApi: true })).toBe(
      GenerationApi.Responses,
    );
  });

  it('resolves to Chat Completions when responsesApi is false', () => {
    expect(resolveGenerationApi({ responsesApi: false })).toBe(
      GenerationApi.ChatCompletions,
    );
  });

  it('resolves to Chat Completions when features is undefined', () => {
    expect(resolveGenerationApi(undefined)).toBe(GenerationApi.ChatCompletions);
  });

  it('resolves to Chat Completions when responsesApi is absent', () => {
    expect(resolveGenerationApi({})).toBe(GenerationApi.ChatCompletions);
  });
});
