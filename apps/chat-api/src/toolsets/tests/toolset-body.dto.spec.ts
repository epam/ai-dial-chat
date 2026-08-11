import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ToolsetAuthType,
  ToolsetBodyDto,
  ToolsetTransport,
} from '../dto/toolset-body.dto';

const BASE_BODY = {
  name: 'My toolset',
  endpoint: 'https://my-toolset.example.com/mcp',
  transport: ToolsetTransport.Http,
  authSettings: { authenticationType: ToolsetAuthType.None },
};

async function validateDto(plain: Record<string, unknown>) {
  const instance = plainToInstance(ToolsetBodyDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('ToolsetBodyDto — intro removal', () => {
  it('passes when no intro property is present', async () => {
    const errors = await validateDto(BASE_BODY);
    expect(errors).toHaveLength(0);
  });

  it('rejects a request body that still includes an intro property', async () => {
    const errors = await validateDto({ ...BASE_BODY, intro: 'Short intro' });
    expect(errors.some((e) => e.property === 'intro')).toBe(true);
  });
});

describe('ToolsetBodyDto — endpoint', () => {
  it('passes when endpoint is an empty string (draft toolset)', async () => {
    const errors = await validateDto({ ...BASE_BODY, endpoint: '' });
    expect(errors).toHaveLength(0);
  });

  it('rejects when endpoint is missing', async () => {
    const { endpoint: _omitted, ...noEndpoint } = BASE_BODY;
    const errors = await validateDto(noEndpoint);
    expect(errors.some((e) => e.property === 'endpoint')).toBe(true);
  });

  it('rejects a non-empty endpoint with an invalid protocol', async () => {
    const errors = await validateDto({ ...BASE_BODY, endpoint: 'ftp://nope' });
    expect(errors.some((e) => e.property === 'endpoint')).toBe(true);
  });
});

describe('ToolsetBodyDto — locales', () => {
  it('passes when locales is omitted', async () => {
    const errors = await validateDto(BASE_BODY);
    expect(errors).toHaveLength(0);
  });

  it('passes with a valid locale entry and primaryLocale', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      locales: [{ language: 'de', name: 'Mein Toolset' }],
      primaryLocale: 'en',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a locale entry with a stray client-side id field', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      locales: [{ id: 'locale-row-1', language: 'de', name: 'Mein Toolset' }],
      primaryLocale: 'en',
    });
    expect(errors.some((e) => e.property === 'locales')).toBe(true);
  });

  it('rejects a locale entry with an invalid language code', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      locales: [{ language: 'not-a-locale!', name: 'Mein Toolset' }],
      primaryLocale: 'en',
    });
    expect(errors.some((e) => e.property === 'locales')).toBe(true);
  });

  it('rejects a non-empty locales array without primaryLocale', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      locales: [{ language: 'de', name: 'Mein Toolset' }],
    });
    expect(errors.some((e) => e.property === 'primaryLocale')).toBe(true);
  });

  it('rejects more than 20 locale entries', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      locales: Array.from({ length: 21 }, (_, i) => ({
        language: 'de',
        name: `Locale ${i}`,
      })),
      primaryLocale: 'en',
    });
    expect(errors.some((e) => e.property === 'locales')).toBe(true);
  });
});

describe('ToolsetBodyDto — authSettings', () => {
  it('rejects when authSettings is missing', async () => {
    const { authSettings: _omitted, ...noAuthSettings } = BASE_BODY;
    const errors = await validateDto(noAuthSettings);
    expect(errors.some((e) => e.property === 'authSettings')).toBe(true);
  });

  it('rejects when authSettings is an empty object', async () => {
    const errors = await validateDto({ ...BASE_BODY, authSettings: {} });
    expect(errors.some((e) => e.property === 'authSettings')).toBe(true);
  });
});
