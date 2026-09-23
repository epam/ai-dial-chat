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

  it('rejects unknown fields such as type', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      type: 'https://mydial.epam.com/custom_application_schemas/quickapps2',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes with a valid applicationProperties object', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      applicationProperties: {
        orchestrator: { system_prompt: { type: 'custom' } },
        tool_sets: [],
      },
    });
    expect(errors).toHaveLength(0);
  });

  it('passes with applicationProperties set to null, treated as not supplied', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      applicationProperties: null,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-object applicationProperties (string)', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      applicationProperties: 'not-an-object',
    });
    expect(errors.some((e) => e.property === 'applicationProperties')).toBe(
      true,
    );
  });

  it('rejects a non-object applicationProperties (array)', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      applicationProperties: [1, 2, 3],
    });
    expect(errors.some((e) => e.property === 'applicationProperties')).toBe(
      true,
    );
  });

  it('passes with version, endpoint, features, inputAttachmentTypes, and maxInputAttachments', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      version: '2.0',
      endpoint: 'https://api.example.com/chat',
      features: { system_prompt: true },
      inputAttachmentTypes: ['image/png'],
      maxInputAttachments: 5,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-URL endpoint (no protocol)', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      endpoint: 'no-protocol.example',
    });
    expect(errors.some((e) => e.property === 'endpoint')).toBe(true);
  });

  it('rejects a negative maxInputAttachments', async () => {
    const errors = await validateDto({ ...BASE_BODY, maxInputAttachments: -1 });
    expect(errors.some((e) => e.property === 'maxInputAttachments')).toBe(true);
  });

  it('rejects a request body that still includes an intro property', async () => {
    const errors = await validateDto({ ...BASE_BODY, intro: 'Short intro' });
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

  it('passes with a valid locale entry and primaryLocale', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      locales: [{ language: 'de', name: 'Meine App' }],
      primaryLocale: 'en',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a locale entry with a stray client-side id field', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      locales: [{ id: 'locale-row-1', language: 'de', name: 'Meine App' }],
      primaryLocale: 'en',
    });
    expect(errors.some((e) => e.property === 'locales')).toBe(true);
  });

  it('rejects a non-empty locales array without primaryLocale', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      locales: [{ language: 'de', name: 'Meine App' }],
    });
    expect(errors.some((e) => e.property === 'primaryLocale')).toBe(true);
  });
});

describe('UpdateApplicationBodyDto — themeUrl', () => {
  it('accepts an absolute https url', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      themeUrl: 'https://themes.contoso.example.com',
    });
    expect(errors).toHaveLength(0);
  });

  /* Omitted means "leave the stored value alone". */
  it('accepts the field being absent', async () => {
    const errors = await validateDto(BASE_BODY);
    expect(errors.some((e) => e.property === 'themeUrl')).toBe(false);
  });

  /* An empty string is the documented "clear it" value. */
  it('accepts an empty string', async () => {
    const errors = await validateDto({ ...BASE_BODY, themeUrl: '' });
    expect(errors.some((e) => e.property === 'themeUrl')).toBe(false);
  });

  it('rejects a plain-http url', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      themeUrl: 'http://themes.contoso.example.com',
    });
    expect(errors.some((e) => e.property === 'themeUrl')).toBe(true);
  });

  it('rejects a string that is not a url', async () => {
    const errors = await validateDto({ ...BASE_BODY, themeUrl: 'nope' });
    expect(errors.some((e) => e.property === 'themeUrl')).toBe(true);
  });
});
