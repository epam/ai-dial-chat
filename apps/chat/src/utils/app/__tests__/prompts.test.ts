import { describe, expect, it } from 'vitest';

import {
  getStorageSafeUniquePromptName,
  replaceDefaultValuesFromContent,
} from '../prompts';

describe('Prompt utility methods', () => {
  it.each([
    ['1 is 2', '{{name}} is {{value}}', '{{name|1}} is {{value|2}}'],
    ['1 is 2', '{{name|3}} is {{value|4}}', '{{name|1}} is {{value|2}}'],
    [
      '111 is 222 333 is 444',
      '{{name}} is {{value}} {{name}} is {{value}}',
      '{{name|111}} is {{value|222}} {{name|333}} is {{value|444}}',
    ],
    [
      'Ilya , 1, 2 {{|test2}} some long value with several worIlya , 3, 4 {{|test2}} some long value with several words',
      'Ilya , 1, 2 {{|test2}} some long value with several wor{{t1}} , {{t2}}, {{t3}} {{|test2}} {{t4}}',
      'Ilya , 1, 2 {{|test2}} some long value with several wor{{t1|Ilya}} , {{t2|3}}, {{t3|4}} {{|test2}} {{t4|some long value with several words}}',
    ],
  ])(
    'replaceDefaultValuesFromContent (%s, %s) = %s',
    (content: string, template: string, expected: string) => {
      expect(replaceDefaultValuesFromContent(content, template)).toBe(expected);
    },
  );

  it('adds numeric suffix and keeps it within byte limit', () => {
    expect(
      getStorageSafeUniquePromptName({
        prompt: { id: 'prompts/test', folderId: 'prompts', name: 'Prompt' },
        desiredName: 'abcdef',
        existingNames: ['abcdef'],
        limits: { maxSegmentBytes: 7 },
      }),
    ).toBe('abcde 1');
  });
});
