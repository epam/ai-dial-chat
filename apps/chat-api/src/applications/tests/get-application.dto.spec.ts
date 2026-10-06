import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { GetApplicationDto } from '../dto/get-application.dto';

const validateDto = async (applicationName: unknown) =>
  validate(plainToInstance(GetApplicationDto, { applicationName }), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('GetApplicationDto', () => {
  it.each([
    'my-app__1.0',
    'a.b',
    '__1.0.0__',
    'gpt-4o-mini-2024-07-18',
    '@org/app:tag',
    'applications/bucket/my-app__1.0.0',
    'applications/bucket/folder/My%20App__1.0.0',
    'applications%2Fbucket%2Fmy-app__1.0.0',
    'applications/bucket/a..b',
  ])('accepts the valid application id %s', async (value) => {
    expect(await validateDto(value)).toHaveLength(0);
  });

  it.each([
    '',
    '.',
    '..',
    'applications/b/../x',
    'applications/b/./x',
    'applications/../x',
    'applications/b/x/..',
    'applications//x',
    'applications/b/%2e%2e/x',
    'applications/b/%2E%2E/x',
    'applications/b/%2e/x',
    'applications%2Fb%2F..%2Fx',
    'applications/b/%2e%2e%2Fx',
    'bad;app',
    'bad app',
    'bad%GGapp',
  ])('rejects the unsafe application id %s', async (value) => {
    const errors = await validateDto(value);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('applicationName');
  });

  it('rejects a non-string application id', async () => {
    expect(await validateDto(42)).toHaveLength(1);
  });
});
