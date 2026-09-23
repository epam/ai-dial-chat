import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateApplicationBodyDto } from '../dto/create-application.dto';

const BASE_BODY = {
  name: 'My App',
  type: 'https://mydial.epam.com/custom_application_schemas/quickapps2',
};

async function validateDto(plain: Record<string, unknown>) {
  const instance = plainToInstance(CreateApplicationBodyDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('CreateApplicationBodyDto — intro removal', () => {
  it('passes when no intro property is present', async () => {
    const errors = await validateDto(BASE_BODY);
    expect(errors).toHaveLength(0);
  });

  it('rejects a request body that still includes an intro property', async () => {
    const errors = await validateDto({ ...BASE_BODY, intro: 'Short intro' });
    expect(errors.some((e) => e.property === 'intro')).toBe(true);
  });
});

describe('CreateApplicationBodyDto — locales', () => {
  it('passes when locales is omitted', async () => {
    const errors = await validateDto(BASE_BODY);
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

  it('accepts a non-ASCII localized name even though the top-level name is ASCII-only', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      locales: [{ language: 'de', name: 'Müller Übersetzung' }],
      primaryLocale: 'en',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-empty locales array without primaryLocale', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      locales: [{ language: 'de', name: 'Meine App' }],
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

describe('CreateApplicationBodyDto — themeUrl', () => {
  it('accepts an absolute https url', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      themeUrl: 'https://themes.contoso.example.com',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts the field being absent', async () => {
    const errors = await validateDto(BASE_BODY);
    expect(errors.some((e) => e.property === 'themeUrl')).toBe(false);
  });

  /* An empty string is the documented "clear it" value, not a bad URL. */
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
    const errors = await validateDto({ ...BASE_BODY, themeUrl: 'not a url' });
    expect(errors.some((e) => e.property === 'themeUrl')).toBe(true);
  });

  it('rejects a scheme-relative url', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      themeUrl: '//themes.contoso.example.com',
    });
    expect(errors.some((e) => e.property === 'themeUrl')).toBe(true);
  });
});
