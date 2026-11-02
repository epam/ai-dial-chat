import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CreateProjectDto,
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_INSTRUCTIONS_MAX_LENGTH,
} from '../dto/create-project.dto';

const validate = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateProjectDto, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('CreateProjectDto', () => {
  it('accepts a name-only request', () => {
    expect(validate({ name: 'Handbook' })).toHaveLength(0);
  });

  it('accepts every field', () => {
    expect(
      validate({
        name: 'Q4 launch',
        description: 'About Q4',
        instructions: '## Steps',
        fileNames: '["tickets.csv"]',
      }),
    ).toHaveLength(0);
  });

  it('rejects a missing or empty name', () => {
    expect(validate({})[0].property).toBe('name');
    expect(validate({ name: '' })[0].property).toBe('name');
  });

  it('counts the description limit in code points', () => {
    expect(
      validate({
        name: 'p',
        description: '😀'.repeat(PROJECT_DESCRIPTION_MAX_LENGTH),
      }),
    ).toHaveLength(0);
    expect(
      validate({
        name: 'p',
        description: 'a'.repeat(PROJECT_DESCRIPTION_MAX_LENGTH + 1),
      })[0].property,
    ).toBe('description');
  });

  it('rejects instructions over the limit', () => {
    expect(
      validate({
        name: 'p',
        instructions: 'a'.repeat(PROJECT_INSTRUCTIONS_MAX_LENGTH + 1),
      })[0].property,
    ).toBe('instructions');
  });

  it('rejects an unknown field', () => {
    expect(validate({ name: 'p', bucket: 'other' })[0].property).toBe('bucket');
  });
});
