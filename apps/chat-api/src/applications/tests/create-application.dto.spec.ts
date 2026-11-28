import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_RESOURCE_VERSIONS,
  REJECTED_RESOURCE_VERSIONS,
} from '../../common/validators/resource-version.corpus';
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
});

describe('CreateApplicationBodyDto — locales', () => {
  it('passes when locales is omitted', async () => {
    const errors = await validateDto(BASE_BODY);
    expect(errors).toHaveLength(0);
  });

  it('accepts a non-ASCII localized name even though the top-level name is ASCII-only', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      locales: [{ language: 'de', name: 'Müller Übersetzung' }],
      primaryLocale: 'en',
    });
    expect(errors).toHaveLength(0);
  });
});
describe('CreateApplicationBodyDto — features', () => {
  it('passes with a top-level features object', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      features: { tools_supported: true },
    });
    expect(errors).toHaveLength(0);
  });

  it.each([[['tools_supported']], ['tools_supported'], [true]])(
    'rejects non-object features (%j)',
    async (features) => {
      const errors = await validateDto({ ...BASE_BODY, features });
      expect(errors.some((e) => e.property === 'features')).toBe(true);
    },
  );
});

describe('CreateApplicationBodyDto — folderPath', () => {
  it.each(['', 'Design', 'Design/Audit Agents'])(
    'accepts the folder path %j',
    async (folderPath) => {
      const errors = await validateDto({ ...BASE_BODY, folderPath });
      expect(errors).toHaveLength(0);
    },
  );

  it.each([
    '../escape',
    'a/../b',
    '/root',
    'trailing/',
    'a//b',
    'a%2Fb',
    'a:b',
  ])('rejects the folder path %j', async (folderPath) => {
    const errors = await validateDto({ ...BASE_BODY, folderPath });
    expect(errors.some((e) => e.property === 'folderPath')).toBe(true);
  });
});

describe('CreateApplicationBodyDto — version', () => {
  it.each(ACCEPTED_RESOURCE_VERSIONS)('accepts version %s', async (version) => {
    const errors = await validateDto({ ...BASE_BODY, version });
    expect(errors.some((e) => e.property === 'version')).toBe(false);
  });

  it.each(REJECTED_RESOURCE_VERSIONS)(
    'rejects version "%s"',
    async (version) => {
      const errors = await validateDto({ ...BASE_BODY, version });
      expect(errors.some((e) => e.property === 'version')).toBe(true);
    },
  );
});
