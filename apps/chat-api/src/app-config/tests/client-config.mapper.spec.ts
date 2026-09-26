import { describe, expect, it, vi } from 'vitest';
import {
  applyClientConfigValue,
  CLIENT_CONFIG_MAPPINGS,
  type ClientConfigMappingInput,
  createDefaultClientConfig,
} from '../client-config.mapper';
import { CONFIG_DEFINITIONS } from '../config-registry/config-registry.constants';

/* `app.version` is resolved by AppConfigService ahead of the loop and is the
 * only client config key the table deliberately leaves out. */
const SPECIAL_CLIENT_KEYS = new Set(['app.version']);

const clientConfigKeys = CONFIG_DEFINITIONS.filter(
  (def) => def.visibility === 'client' && def.type === 'config',
).map((def) => def.key);

const makeInput = (
  overrides: Partial<ClientConfigMappingInput> = {},
): ClientConfigMappingInput => ({
  resolved: undefined,
  appVersion: '1.2.3',
  warn: vi.fn(),
  ...overrides,
});

describe('CLIENT_CONFIG_MAPPINGS', () => {
  describe('registry coverage', () => {
    it('maps every client-visible config key except app.version', () => {
      const unmapped = clientConfigKeys.filter(
        (key) =>
          !SPECIAL_CLIENT_KEYS.has(key) && !CLIENT_CONFIG_MAPPINGS.has(key),
      );
      expect(
        unmapped,
        `unmapped client config keys: ${unmapped.join(', ')}`,
      ).toEqual([]);
    });

    it('names only keys that are client-visible config keys in the registry', () => {
      const clientKeys = new Set(clientConfigKeys);
      const stale = [...CLIENT_CONFIG_MAPPINGS.keys()].filter(
        (key) => !clientKeys.has(key) || SPECIAL_CLIENT_KEYS.has(key),
      );
      expect(stale, `stale mapping keys: ${stale.join(', ')}`).toEqual([]);
    });

    it('leaves app.version as the only unmapped client config key', () => {
      expect(
        clientConfigKeys.filter((key) => !CLIENT_CONFIG_MAPPINGS.has(key)),
      ).toEqual(['app.version']);
    });

    it('has no entry for server-visible or feature keys', () => {
      const excluded = CONFIG_DEFINITIONS.filter(
        (def) => def.visibility === 'server' || def.type === 'feature',
      ).map((def) => def.key);

      expect(excluded).toContain('utility.modelId');
      for (const key of excluded) {
        expect(CLIENT_CONFIG_MAPPINGS.has(key), key).toBe(false);
      }
    });

    it('assigns each response field to exactly one entry and covers every default field', () => {
      const fields = [...CLIENT_CONFIG_MAPPINGS.values()].map(
        (mapping) => mapping.field,
      );
      const duplicated = fields.filter(
        (field, index) => fields.indexOf(field) !== index,
      );

      expect(
        duplicated,
        `fields owned twice: ${duplicated.join(', ')}`,
      ).toEqual([]);
      expect([...fields].sort()).toEqual(
        Object.keys(createDefaultClientConfig()).sort(),
      );
    });
  });

  describe('createDefaultClientConfig', () => {
    it('returns a new object with new arrays and objects on each call', () => {
      const first = createDefaultClientConfig();
      const second = createDefaultClientConfig();

      expect(second).toEqual(first);
      expect(second).not.toBe(first);
      expect(second.fileManagerTabs).not.toBe(first.fileManagerTabs);
      expect(second.publicationFilterSources).not.toBe(
        first.publicationFilterSources,
      );
      expect(second.overlayAllowedOrigins).not.toBe(
        first.overlayAllowedOrigins,
      );
      expect(second.customVariables).not.toBe(first.customVariables);
      expect(second.applicationVisualizers).not.toBe(
        first.applicationVisualizers,
      );
    });

    it('does not let a mutated accumulator change later defaults', () => {
      createDefaultClientConfig().fileManagerTabs.push('leaked');

      expect(createDefaultClientConfig().fileManagerTabs).toEqual([
        'my_files',
        'shared',
        'organization',
      ]);
    });
  });

  describe('applyClientConfigValue', () => {
    it.each(['constructor', '__proto__', 'toString', 'unknown.key'])(
      'leaves the accumulator unchanged for the unmapped key %s',
      (key) => {
        const config = createDefaultClientConfig();

        expect(() =>
          applyClientConfigValue(config, key, makeInput({ resolved: 'x' })),
        ).not.toThrow();
        expect(config).toEqual(createDefaultClientConfig());
      },
    );

    it('returns a fresh copy for a wrong-shape fallback', () => {
      const first = createDefaultClientConfig();
      const second = createDefaultClientConfig();
      const initial = first.fileManagerTabs;

      applyClientConfigValue(
        first,
        'fileManager.availableTabs',
        makeInput({ resolved: 'x' }),
      );
      applyClientConfigValue(
        second,
        'fileManager.availableTabs',
        makeInput({ resolved: 'x' }),
      );

      expect(first.fileManagerTabs).toEqual([
        'my_files',
        'shared',
        'organization',
      ]);
      expect(first.fileManagerTabs).not.toBe(initial);
      expect(first.fileManagerTabs).not.toBe(second.fileManagerTabs);
    });

    it('passes a provider array through by reference without copying it', () => {
      const tabs = ['my_files'];
      const config = createDefaultClientConfig();

      applyClientConfigValue(
        config,
        'fileManager.availableTabs',
        makeInput({ resolved: tabs }),
      );

      expect(config.fileManagerTabs).toBe(tabs);
    });

    it('substitutes the given appVersion into the footer', () => {
      const config = createDefaultClientConfig();

      applyClientConfigValue(
        config,
        'footer.html',
        makeInput({ resolved: 'Build %%VERSION%%', appVersion: '9.9.9' }),
      );

      expect(config.footerHtmlMessage).toBe('Build 9.9.9');
    });

    it('forwards the warn callback to the enabled-UI-features normalizer', () => {
      const warn = vi.fn();
      const config = createDefaultClientConfig();

      applyClientConfigValue(
        config,
        'uiFeatures.enabledUiFeatures',
        makeInput({ resolved: ['not-a-real-feature'], warn }),
      );

      expect(config.enabledUiFeatures).toBeNull();
      expect(warn).toHaveBeenCalledWith(
        'Ignoring unrecognized ENABLED_UI_FEATURES entry: "not-a-real-feature"',
      );
    });

    it('forwards the warn callback to the announcements normalizer', () => {
      const warn = vi.fn();
      const config = createDefaultClientConfig();

      applyClientConfigValue(
        config,
        'announcement.items',
        makeInput({ resolved: 'not-an-array', warn }),
      );

      expect(config.announcements).toEqual([]);
      expect(warn).toHaveBeenCalledOnce();
    });
  });
});
