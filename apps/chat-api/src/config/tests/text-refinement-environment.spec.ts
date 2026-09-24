import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { EnvironmentVariables } from '../environment.config';

describe('Text refinement configuration', () => {
  const errors = (model: unknown) =>
    validateSync(
      plainToInstance(EnvironmentVariables, {
        UTILITY_MODEL: model,
      }),
    ).filter((error) => error.property === 'UTILITY_MODEL');
  it.each([
    undefined,
    '',
    '  ',
    'gpt-4o',
    'provider/model:version@deployment',
    'opaque deployment ID',
  ])('preserves the shared optional-string configuration for %s', (model) => {
    expect(errors(model)).toEqual([]);
  });
  it.each([123, {}, true])('rejects non-string utility model %s', (model) => {
    expect(errors(model)).not.toEqual([]);
  });
});
