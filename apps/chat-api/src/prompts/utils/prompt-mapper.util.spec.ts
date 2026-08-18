import { describe, expect, it } from 'vitest';
import { toPromptResourceUrl } from './prompt-mapper.util';

describe('toPromptResourceUrl', () => {
  it('builds a resource url for a root-level prompt', () => {
    expect(toPromptResourceUrl('greeting', 'bucket-1')).toBe(
      'prompts/bucket-1/greeting',
    );
  });

  it('percent-encodes each segment of a prompt nested inside a folder', () => {
    expect(toPromptResourceUrl('New folder 1/Prompt 1', 'bucket-1')).toBe(
      'prompts/bucket-1/New%20folder%201/Prompt%201',
    );
  });

  it('does not double-encode an already-encoded path', () => {
    expect(toPromptResourceUrl('New%20folder%201/Prompt%201', 'bucket-1')).toBe(
      'prompts/bucket-1/New%20folder%201/Prompt%201',
    );
  });
});
