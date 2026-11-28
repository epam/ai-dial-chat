import { type ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateApplicationBodyDto } from '../../../applications/dto/create-application.dto';
import { UpdateApplicationBodyDto } from '../../../applications/dto/update-application.dto';
import {
  ToolsetAuthType,
  ToolsetBodyDto,
  ToolsetTransport,
} from '../../../toolsets/dto/toolset-body.dto';

/*
 * The application and toolset body DTOs each declare the same `locales` /
 * `primaryLocale` decorators and dropped `intro`. One suite runs every rule
 * against each class, so a decorator removed from one DTO still fails here.
 */
interface LocalizedBodyCase {
  /** DTO class under test. */
  dto: ClassConstructor<object>;
  /** Smallest body the DTO accepts. */
  baseBody: Record<string, unknown>;
}

describe.each<[string, LocalizedBodyCase]>([
  [
    'CreateApplicationBodyDto',
    {
      dto: CreateApplicationBodyDto,
      baseBody: {
        name: 'My App',
        type: 'https://mydial.epam.com/custom_application_schemas/quickapps2',
      },
    },
  ],
  [
    'UpdateApplicationBodyDto',
    { dto: UpdateApplicationBodyDto, baseBody: { name: 'My App' } },
  ],
  [
    'ToolsetBodyDto',
    {
      dto: ToolsetBodyDto,
      baseBody: {
        name: 'My toolset',
        endpoint: 'https://my-toolset.example.com/mcp',
        transport: ToolsetTransport.Http,
        authSettings: { authenticationType: ToolsetAuthType.None },
      },
    },
  ],
])('%s — locale and intro rules', (_name, { dto, baseBody }) => {
  const validateDto = async (plain: Record<string, unknown>) =>
    validate(plainToInstance(dto, plain), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

  it('rejects a request body that still includes an intro property', async () => {
    const errors = await validateDto({ ...baseBody, intro: 'Short intro' });
    expect(errors.some((e) => e.property === 'intro')).toBe(true);
  });

  it('passes with a valid locale entry and primaryLocale', async () => {
    const errors = await validateDto({
      ...baseBody,
      locales: [{ language: 'de', name: 'Meine App' }],
      primaryLocale: 'en',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a locale entry with a stray client-side id field', async () => {
    const errors = await validateDto({
      ...baseBody,
      locales: [{ id: 'locale-row-1', language: 'de', name: 'Meine App' }],
      primaryLocale: 'en',
    });
    expect(errors.some((e) => e.property === 'locales')).toBe(true);
  });

  it('rejects a non-empty locales array without primaryLocale', async () => {
    const errors = await validateDto({
      ...baseBody,
      locales: [{ language: 'de', name: 'Meine App' }],
    });
    expect(errors.some((e) => e.property === 'primaryLocale')).toBe(true);
  });

  it('rejects more than 20 locale entries', async () => {
    const errors = await validateDto({
      ...baseBody,
      locales: Array.from({ length: 21 }, (_, i) => ({
        language: 'de',
        name: `Locale ${i}`,
      })),
      primaryLocale: 'en',
    });
    expect(errors.some((e) => e.property === 'locales')).toBe(true);
  });
});
