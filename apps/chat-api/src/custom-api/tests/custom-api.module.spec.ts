import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomApiRegistryService } from '../custom-api-registry.service';

/*
 * Module/startup regression coverage for CUSTOM_CORE_API_CONFIG. See
 * openspec/changes/archive/2026-10-02-add-configured-core-api-operations/design.md §2 and the
 * acceptance criteria in proposal.md. Complements
 * custom-api-registry.service.spec.ts (parsing edge cases) with the
 * app-boundary guarantees: startup fail-closed behavior, no client-config
 * leak, no startup network traffic, and no auth/bootstrap changes beyond
 * normal module wiring.
 */

const buildRegistry = async (
  customCoreApiConfig: string | undefined,
): Promise<CustomApiRegistryService> => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      CustomApiRegistryService,
      {
        provide: ConfigService,
        useValue: { get: () => customCoreApiConfig },
      },
    ],
  }).compile();

  return moduleRef.get(CustomApiRegistryService);
};

describe('CustomApiModule startup regression', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([undefined, '', '   ', '{"version":1,"operations":[]}'])(
    'boots successfully with no enabled operations for %p',
    async (value) => {
      const registry = await buildRegistry(value);
      expect(registry.get('anything')).toBeUndefined();
    },
  );

  it('fails startup for an invalid value without exposing it in the thrown error', async () => {
    const secretLookingValue = '{"version":1,"operations":["should-not-leak"]}';
    let thrown: unknown;
    try {
      await buildRegistry(secretLookingValue);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain('should-not-leak');
  });

  it('boots successfully and enables the configured operation for a valid value', async () => {
    const registry = await buildRegistry(
      '{"version":1,"operations":[{"id":"data-products","method":"GET","corePath":"/data-products"}]}',
    );
    expect(registry.get('data-products')).toMatchObject({
      id: 'data-products',
      corePath: '/data-products',
    });
  });

  it('performs no network call while constructing the registry', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await buildRegistry(
      '{"version":1,"operations":[{"id":"data-products","method":"GET","corePath":"/data-products"}]}',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ships no private enabled operation in the repository default (blank .env.template)', () => {
    const envTemplate = readFileSync(
      join(__dirname, '../../../.env.template'),
      'utf8',
    );
    const line = envTemplate
      .split('\n')
      .find((l) => l.trim().startsWith('CUSTOM_CORE_API_CONFIG='));
    expect(line).toBeUndefined();
  });

  it('keeps CUSTOM_CORE_API_CONFIG out of client-config source', () => {
    const appConfigService = readFileSync(
      join(__dirname, '../../app-config/app-config.service.ts'),
      'utf8',
    );
    expect(appConfigService).not.toContain('CUSTOM_CORE_API_CONFIG');
  });

  it('adds no BFF role/schema duplication module alongside the registry', () => {
    // A custom-api-access.service.ts or role-policy module would indicate
    // the BFF re-implementing Core's own role authorization, which
    // `openspec/changes/archive/2026-10-02-add-configured-core-api-operations/design.md` explicitly forbids.
    expect(() =>
      readFileSync(join(__dirname, '../custom-api-access.service.ts'), 'utf8'),
    ).toThrow();
  });

  it('registers CustomApiModule as normal module wiring, with no new global guard/interceptor', () => {
    const appModuleSource = readFileSync(
      join(__dirname, '../../app/app.module.ts'),
      'utf8',
    );
    expect(appModuleSource).toContain('CustomApiModule');
    // The feature's only capability gate is CUSTOM_CORE_API_CONFIG itself —
    // no additional APP_GUARD/APP_INTERCEPTOR was introduced for it.
    expect(appModuleSource).not.toMatch(/CustomApi.*(?:Guard|Interceptor)/);
  });
});
