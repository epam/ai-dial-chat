import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateApplicationBodyDto } from '../dto/update-application.dto';

const BASE_BODY = {
  name: 'My App',
};

const validateDto = async (plain: Record<string, unknown>) => {
  const instance = plainToInstance(UpdateApplicationBodyDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
};

describe('UpdateApplicationBodyDto', () => {
  it('passes with only a name', async () => {
    const errors = await validateDto(BASE_BODY);
    expect(errors).toHaveLength(0);
  });

  it('rejects when name is missing', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a name with disallowed characters', async () => {
    const errors = await validateDto({ ...BASE_BODY, name: 'bad/name' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects unknown fields such as type, version, or applicationProperties', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      type: 'https://mydial.epam.com/custom_application_schemas/quickapps2',
      version: '2.0',
      applicationProperties: { tool_sets: [] },
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes when intro is exactly 90 characters', async () => {
    const errors = await validateDto({ ...BASE_BODY, intro: 'a'.repeat(90) });
    expect(errors).toHaveLength(0);
  });

  it('rejects intro longer than 90 characters', async () => {
    const errors = await validateDto({ ...BASE_BODY, intro: 'a'.repeat(91) });
    expect(errors.some((e) => e.property === 'intro')).toBe(true);
  });

  it('passes with description, iconUrl, and topics provided', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      description: 'A description',
      iconUrl: 'https://example.com/icon.svg',
      topics: ['nlp'],
    });
    expect(errors).toHaveLength(0);
  });
});
