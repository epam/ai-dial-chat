import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ApplicationResourceDependencyDto,
  MAX_RESOURCE_DEPENDENCIES,
} from '../dto/resource-dependency.dto';
import { UpdateApplicationBodyDto } from '../dto/update-application.dto';

const entry = (overrides: Record<string, unknown> = {}) => ({
  linkId: 'access-files',
  target: { url: 'files/{current-user}/' },
  access: ['READ'],
  ...overrides,
});

const validateEntry = async (plain: unknown) =>
  validate(plainToInstance(ApplicationResourceDependencyDto, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

const validateUpdate = async (resourceDependencies: unknown) =>
  validate(
    plainToInstance(UpdateApplicationBodyDto, {
      name: 'My App',
      resourceDependencies,
    }),
    { whitelist: true, forbidNonWhitelisted: true },
  );

describe('ApplicationResourceDependencyDto', () => {
  it('accepts a valid entry', async () => {
    expect(await validateEntry(entry())).toHaveLength(0);
  });

  it('accepts read and write with required', async () => {
    expect(
      await validateEntry(entry({ access: ['READ', 'WRITE'], required: true })),
    ).toHaveLength(0);
  });

  it('rejects an empty access list', async () => {
    const errors = await validateEntry(entry({ access: [] }));
    expect(errors.some((e) => e.property === 'access')).toBe(true);
  });

  it('rejects SHARE', async () => {
    const errors = await validateEntry(entry({ access: ['SHARE'] }));
    expect(errors.some((e) => e.property === 'access')).toBe(true);
  });

  it('rejects an empty linkId', async () => {
    const errors = await validateEntry(entry({ linkId: '' }));
    expect(errors.some((e) => e.property === 'linkId')).toBe(true);
  });

  it('rejects an unknown field such as kind', async () => {
    const errors = await validateEntry(entry({ kind: 'dial.resourceLink' }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a missing target', async () => {
    const errors = await validateEntry({ linkId: 'a', access: ['READ'] });
    expect(errors.some((e) => e.property === 'target')).toBe(true);
  });

  it.each([
    'users/abc/',
    'models/b/x',
    'files',
    'files/',
    'files//x',
    'files/b//x/',
    'files/b/../x',
    'files/b/./x',
    'files/b/*',
    'files/b/a b',
    'files/b/\nx',
    'http://evil.example/files/b/',
    `files/b/${'a'.repeat(1030)}`,
  ])('rejects the target url %j', async (url) => {
    const errors = await validateEntry(entry({ target: { url } }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it.each([
    'files/{current-user}/',
    'files/public/policies/',
    'prompts/{current-user}/',
    'conversations/{current-user}/',
    'applications/{current-user}/',
    'toolsets/{current-user}/',
    'skills/{current-user}/',
    'projects/{current-user}/',
    'files/6FEupAbC/My%20Folder/doc%2Bv1.pdf',
    'files/public/policies/a..b/x.txt',
    'files/b/folder',
  ])('accepts the Core-valid target url %j', async (url) => {
    expect(await validateEntry(entry({ target: { url } }))).toHaveLength(0);
  });
});

describe('resourceDependencies on the application bodies', () => {
  it('accepts a list on update, including an empty one', async () => {
    expect(await validateUpdate([entry()])).toHaveLength(0);
    expect(await validateUpdate([])).toHaveLength(0);
  });

  it('accepts exactly the maximum number of entries', async () => {
    const list = Array.from({ length: MAX_RESOURCE_DEPENDENCIES }, (_, i) =>
      entry({ linkId: `link-${i}` }),
    );
    expect(await validateUpdate(list)).toHaveLength(0);
  });

  it('rejects more than the maximum number of entries', async () => {
    const list = Array.from({ length: MAX_RESOURCE_DEPENDENCIES + 1 }, (_, i) =>
      entry({ linkId: `link-${i}` }),
    );
    const errors = await validateUpdate(list);
    expect(errors.some((e) => e.property === 'resourceDependencies')).toBe(
      true,
    );
  });

  it('reports a nested invalid entry on update', async () => {
    const errors = await validateUpdate([entry({ access: [] })]);
    expect(errors.some((e) => e.property === 'resourceDependencies')).toBe(
      true,
    );
  });

  it('keeps a stored administrator entry byte-exact', async () => {
    const stored = entry({
      linkId: 'admin-policies',
      target: { url: 'files/public/policies/' },
      required: true,
    });
    const instance = plainToInstance(UpdateApplicationBodyDto, {
      name: 'My App',
      resourceDependencies: [stored],
    });
    expect(await validate(instance, { whitelist: true })).toHaveLength(0);
    expect(instance.resourceDependencies?.[0]).toMatchObject(stored);
  });
});
