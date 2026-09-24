import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import packageJson from '../../../package.json';
import { AppConfigService } from '../app-config.service';
import type { AppConfigEvalContext } from '../app-config.types';
import type { CompositeConfigProvider } from '../config-registry/composite-config.provider';
import { CONFIG_DEFINITIONS } from '../config-registry/config-registry.constants';
import { FeatureKey } from '../feature-flags/feature-key.enum';

const ctx: AppConfigEvalContext = { appId: 'chat-ui' };

const PACKAGE_VERSION: string = packageJson.version;

// getClientConfig resolves exactly one definition per client-visible config key.
const CLIENT_DEFINITIONS_COUNT = CONFIG_DEFINITIONS.filter(
  (def) => def.visibility === 'client',
).length;

function makeService(
  resolveImpl: (key: string) => Promise<unknown | undefined>,
  model?: string,
) {
  const compositeProvider = {
    resolve: vi.fn(resolveImpl),
  } as unknown as CompositeConfigProvider;
  const cacheStore = new Map<string, unknown>();
  const cacheManager = {
    get: vi.fn(async (key: string) => cacheStore.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      cacheStore.set(key, value);
    }),
  };
  return {
    service: new AppConfigService(
      compositeProvider,
      cacheManager as never,
      new ConfigService({ UTILITY_MODEL: model }),
    ),
    cacheManager,
    compositeProvider,
  };
}

describe('AppConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getClientConfig', () => {
    it('exposes the configured external connection origins', async () => {
      const origins = [
        'https://documents.example.com',
        'https://*.example.org',
      ];
      const { service } = makeService(async (key) =>
        key === 'documents.allowedConnectOrigins' ? origins : undefined,
      );
      expect(
        (await service.getClientConfig(ctx)).config.allowedConnectOrigins,
      ).toEqual(origins);
    });
    it.each([undefined, '', '  ', 'refinement-model', ' refinement-model '])(
      'exposes only refinement availability for model %s',
      async (model) => {
        const { service } = makeService(async () => undefined, model);
        const result = await service.getClientConfig(ctx);
        expect(result.config.aiTextRefinementAvailable).toBe(
          Boolean(model?.trim()),
        );
        expect(JSON.stringify(result)).not.toContain('refinement-model');
      },
    );
    it('keeps client-owned variables in their own namespace without overriding built-in config', async () => {
      const custom = {
        defaultDeploymentId: 'custom-only',
        asrEnabled: true,
        nested: { values: [null, false, 3] },
      };
      const { service } = makeService(async (key) =>
        key === 'customVariables' ? custom : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.customVariables).toEqual(custom);
      expect(result.config.defaultDeploymentId).toBeNull();
      expect(result.features['asrEnabled']).toBe(false);
    });
    it.each([undefined, null, [], 'invalid', 4])(
      'returns empty custom variables for missing or invalid provider value %j',
      async (value) => {
        const { service } = makeService(async (key) =>
          key === 'customVariables' ? value : undefined,
        );
        expect(
          (await service.getClientConfig(ctx)).config.customVariables,
        ).toEqual({});
      },
    );
    it('filters server-only keys and only returns client-visible config', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.getClientConfig(ctx);

      // No server-only keys should appear in features or config
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('roles');
      expect(result).not.toHaveProperty('environment');
      expect(result.appId).toBe('chat-ui');
      expect(typeof result.features).toBe('object');
      expect(typeof result.config).toBe('object');
    });

    it('returns safe defaults when all providers return undefined', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.getClientConfig(ctx);

      expect(result.features['asrEnabled']).toBe(false);
      expect(result.config.appVersion).toBe(PACKAGE_VERSION);
      expect(result.config.asrModelId).toBeNull();
      expect(result.config.transcribeSizeLimitBytes).toBe(5 * 1024 * 1024);
      expect(result.config.defaultDeploymentId).toBeNull();
      expect(result.config.dialCoreExternalUrl).toBeNull();
      expect(result.config.fileManagerTabs).toEqual([
        'my_files',
        'shared',
        'organization',
      ]);
      expect(result.config.overlayEnabled).toBe(false);
      expect(result.config.overlayAllowedOrigins).toEqual([]);
      expect(result.config.allowedConnectOrigins).toEqual([]);
      expect(result.config.enabledUiFeatures).toBeNull();
      expect(result.config.announcementHtml).toBeNull();
      expect(result.config.footerHtmlMessage).toBe('');
      expect(result.config.customVisualizers).toEqual([]);
      expect(result.config.applicationVisualizers).toEqual({});
      expect(result.config.publicationFilterSources).toEqual([
        'title',
        'role',
        'dial_roles',
      ]);
      expect(result.config.maxAttachmentFileSizeBytes).toBe(536_870_912);
    });

    it('surfaces an operator-configured maxAttachmentFileSizeBytes value', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'attachments.maxFileSizeBytes' ? 104_857_600 : undefined,
      );
      const result = await service.getClientConfig(ctx);

      expect(result.config.maxAttachmentFileSizeBytes).toBe(104_857_600);
    });

    it('surfaces an operator-configured publicationFilterSources list verbatim', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'publish.publicationFilterSources'
          ? ['roles', 'department']
          : undefined,
      );
      const result = await service.getClientConfig(ctx);

      expect(result.config.publicationFilterSources).toEqual([
        'roles',
        'department',
      ]);
    });

    it('surfaces the resolved customVisualizers registry verbatim', async () => {
      const entry = {
        contentType: 'application/x-my-viz',
        url: 'https://viz.example.com',
        title: 'my-viz',
      };
      const { service } = makeService(async (key: string) =>
        key === 'customVisualizers' ? [entry] : undefined,
      );
      const result = await service.getClientConfig(ctx);

      expect(result.config.customVisualizers).toEqual([entry]);
    });

    it('surfaces the resolved applicationVisualizers registry verbatim', async () => {
      const registry = {
        'app-1': {
          title: 'my-viz',
          url: 'https://viz.example.com',
          passAuthInfo: true,
        },
      };
      const { service } = makeService(async (key: string) =>
        key === 'applicationVisualizers' ? registry : undefined,
      );
      const result = await service.getClientConfig(ctx);

      expect(result.config.applicationVisualizers).toEqual(registry);
    });

    it('falls back to an empty applicationVisualizers registry when the resolved value is an array', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'applicationVisualizers' ? [] : undefined,
      );
      const result = await service.getClientConfig(ctx);

      expect(result.config.applicationVisualizers).toEqual({});
    });

    it('returns resolved values when providers succeed', async () => {
      const { service } = makeService(async (key: string) => {
        if (key === 'asr.modelId') return 'whisper-1';
        if (key === 'features.asrEnabled') return true;
        if (key === 'asr.transcribeSizeLimitBytes') return 10_485_760;
        if (key === 'deployments.defaultDeploymentId') return 'gpt-4o';
        if (key === 'dialCore.externalUrl') return 'https://dial.example.com';
        if (key === 'fileManager.availableTabs') return ['my_files'];
        if (key === 'overlay.enabled') return true;
        if (key === 'overlay.allowedOrigins')
          return ['https://partner.example.com'];
        if (key === 'uiFeatures.enabledUiFeatures') return ['likes'];
        if (key === 'announcement.html') return 'Welcome to <b>DIAL</b>!';
        return undefined;
      });
      const result = await service.getClientConfig(ctx);

      expect(result.features['asrEnabled']).toBe(true);
      expect(result.config.asrModelId).toBe('whisper-1');
      expect(result.config.transcribeSizeLimitBytes).toBe(10_485_760);
      expect(result.config.defaultDeploymentId).toBe('gpt-4o');
      expect(result.config.dialCoreExternalUrl).toBe(
        'https://dial.example.com',
      );
      expect(result.config.fileManagerTabs).toEqual(['my_files']);
      expect(result.config.overlayEnabled).toBe(true);
      expect(result.config.overlayAllowedOrigins).toEqual([
        'https://partner.example.com',
      ]);
      expect(result.config.enabledUiFeatures).toEqual(['likes']);
    });

    it('filters unrecognized enabledUiFeatures entries, keeps known ones, and logs a warning', async () => {
      const { service } = makeService(async (key: string) => {
        if (key === 'uiFeatures.enabledUiFeatures')
          return ['likes', 'not-a-real-feature'];
        return undefined;
      });
      const warnSpy = vi
        .spyOn(
          (service as never as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const result = await service.getClientConfig(ctx);

      expect(result.config.enabledUiFeatures).toEqual(['likes']);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not-a-real-feature'),
      );
    });

    it('resolves a deprecated enabledUiFeatures alias to its replacement and logs a warning', async () => {
      const { service } = makeService(async (key: string) => {
        if (key === 'uiFeatures.enabledUiFeatures')
          return ['likes', 'custom-applications'];
        return undefined;
      });
      const warnSpy = vi
        .spyOn(
          (service as never as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const result = await service.getClientConfig(ctx);

      expect(result.config.enabledUiFeatures).toEqual(['likes', 'schema-apps']);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('custom-applications'),
      );
    });

    it('does not duplicate a feature supplied both under its deprecated alias and its current name', async () => {
      const { service } = makeService(async (key: string) => {
        if (key === 'uiFeatures.enabledUiFeatures')
          return ['schema-apps', 'custom-applications'];
        return undefined;
      });

      const result = await service.getClientConfig(ctx);

      expect(result.config.enabledUiFeatures).toEqual(['schema-apps']);
    });

    it('falls back to null (use defaults) when every enabledUiFeatures entry is unrecognized', async () => {
      const { service } = makeService(async (key: string) => {
        if (key === 'uiFeatures.enabledUiFeatures') return ['totally-invalid'];
        return undefined;
      });

      const result = await service.getClientConfig(ctx);

      expect(result.config.enabledUiFeatures).toBeNull();
    });

    it.each([
      ['a non-array value', 'not-an-array'],
      ['an empty array', []],
    ])(
      'falls back to null with no warning when enabledUiFeatures resolves to %s',
      async (_label, value) => {
        const { service } = makeService(async (key: string) =>
          key === 'uiFeatures.enabledUiFeatures' ? value : undefined,
        );
        const warnSpy = vi
          .spyOn(
            (service as never as { logger: { warn: () => void } }).logger,
            'warn',
          )
          .mockImplementation(() => undefined);

        const result = await service.getClientConfig(ctx);

        expect(result.config.enabledUiFeatures).toBeNull();
        expect(warnSpy).not.toHaveBeenCalled();
      },
    );

    it('preserves the input order of multiple recognized enabledUiFeatures entries', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'uiFeatures.enabledUiFeatures'
          ? ['likes', 'header', 'prompts']
          : undefined,
      );

      const result = await service.getClientConfig(ctx);

      expect(result.config.enabledUiFeatures).toEqual([
        'likes',
        'header',
        'prompts',
      ]);
    });

    it('coerces a non-string enabledUiFeatures entry with String() before reporting it', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'uiFeatures.enabledUiFeatures' ? [42] : undefined,
      );
      const warnSpy = vi
        .spyOn(
          (service as never as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const result = await service.getClientConfig(ctx);

      expect(result.config.enabledUiFeatures).toBeNull();
      expect(warnSpy).toHaveBeenNthCalledWith(
        1,
        'Ignoring unrecognized ENABLED_UI_FEATURES entry: "42"',
      );
    });

    it('logs the unrecognized-entry warning once per repeated occurrence, in order', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'uiFeatures.enabledUiFeatures'
          ? ['bogus', 'likes', 'bogus']
          : undefined,
      );
      const warnSpy = vi
        .spyOn(
          (service as never as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const result = await service.getClientConfig(ctx);

      expect(result.config.enabledUiFeatures).toEqual(['likes']);
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenNthCalledWith(
        1,
        'Ignoring unrecognized ENABLED_UI_FEATURES entry: "bogus"',
      );
      expect(warnSpy).toHaveBeenNthCalledWith(
        2,
        'Ignoring unrecognized ENABLED_UI_FEATURES entry: "bogus"',
      );
    });

    it('logs the deprecated-alias warning once per repeated occurrence, in order', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'uiFeatures.enabledUiFeatures'
          ? ['custom-applications', 'custom-applications']
          : undefined,
      );
      const warnSpy = vi
        .spyOn(
          (service as never as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const result = await service.getClientConfig(ctx);

      expect(result.config.enabledUiFeatures).toEqual(['schema-apps']);
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenNthCalledWith(
        1,
        'ENABLED_UI_FEATURES entry "custom-applications" is deprecated; using "schema-apps" instead',
      );
      expect(warnSpy).toHaveBeenNthCalledWith(
        2,
        'ENABLED_UI_FEATURES entry "custom-applications" is deprecated; using "schema-apps" instead',
      );
    });

    it('returns null defaultDeploymentId when DEFAULT_DEPLOYMENT is not set', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.getClientConfig(ctx);
      expect(result.config.defaultDeploymentId).toBeNull();
    });

    it('returns null dialCoreExternalUrl when DIAL_CORE_EXTERNAL_URL is not set', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.getClientConfig(ctx);
      expect(result.config.dialCoreExternalUrl).toBeNull();
    });

    it('returns null announcementHtml when ANNOUNCEMENT_HTML_MESSAGE is not set', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcementHtml).toBeNull();
    });

    it('returns the configured announcementHtml when ANNOUNCEMENT_HTML_MESSAGE is set', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.html' ? 'Welcome to <b>DIAL</b>!' : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcementHtml).toBe('Welcome to <b>DIAL</b>!');
    });

    it('returns null announcement title and description when neither variable is set', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcementTitle).toBeNull();
      expect(result.config.announcementDescription).toBeNull();
    });

    it('returns the configured announcement title and description', async () => {
      const { service } = makeService(async (key: string) => {
        if (key === 'announcement.title') return '🎉 Welcome to DIAL! 🎉';
        if (key === 'announcement.description')
          return 'Explore our AI offerings with your data.';
        return undefined;
      });
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcementTitle).toBe('🎉 Welcome to DIAL! 🎉');
      expect(result.config.announcementDescription).toBe(
        'Explore our AI offerings with your data.',
      );
    });

    it('treats blank and whitespace-only announcement values as unset', async () => {
      const { service } = makeService(async (key: string) => {
        if (key === 'announcement.title') return '   ';
        if (key === 'announcement.description') return '';
        return undefined;
      });
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcementTitle).toBeNull();
      expect(result.config.announcementDescription).toBeNull();
    });

    it('does not treat the announcement title as markup', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.title' ? 'Release <b>3.0</b>' : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcementTitle).toBe('Release <b>3.0</b>');
    });

    it('preserves safe markup in the announcement description', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.description'
          ? 'Explore our <strong>AI offerings</strong>.'
          : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcementDescription).toBe(
        'Explore our <strong>AI offerings</strong>.',
      );
    });

    it('strips scripts, images, and inline handlers from the announcement description', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.description'
          ? 'Hi<script>alert(1)</script><img src=x onerror="alert(1)">'
          : undefined,
      );
      const result = await service.getClientConfig(ctx);
      const description = result.config.announcementDescription ?? '';
      expect(description).not.toContain('<script');
      expect(description).not.toContain('<img');
      expect(description).not.toContain('onerror');
      expect(description).toContain('Hi');
    });

    it('neutralizes javascript: URLs in the announcement description', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.description'
          ? '<a href="javascript:alert(1)">x</a>'
          : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcementDescription).not.toContain(
        'javascript:',
      );
    });

    it('forces external announcement description links to open safely', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.description'
          ? '<a href="https://dialx.ai">docs</a>'
          : undefined,
      );
      const result = await service.getClientConfig(ctx);
      const description = result.config.announcementDescription ?? '';
      expect(description).toContain('target="_blank"');
      expect(description).toContain('rel="noopener noreferrer"');
    });

    it('returns null when the announcement description sanitizes away entirely', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.description'
          ? '<script>alert(1)</script>'
          : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcementDescription).toBeNull();
    });

    it('resolves the announcement fields independently of one another', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.title' ? 'Title only' : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcementTitle).toBe('Title only');
      expect(result.config.announcementDescription).toBeNull();
      expect(result.config.announcementHtml).toBeNull();
    });

    it('keeps the legacy announcement message alongside the new fields', async () => {
      const { service } = makeService(async (key: string) => {
        if (key === 'announcement.html') return 'Legacy message';
        if (key === 'announcement.title') return 'New title';
        return undefined;
      });
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcementHtml).toBe('Legacy message');
      expect(result.config.announcementTitle).toBe('New title');
    });

    it('returns an empty announcements list when ANNOUNCEMENTS is not set', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcements).toEqual([]);
    });

    it('returns a complete announcement entry', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [
              {
                title: 'We have upgraded to DIAL 1.43',
                description: "Check what's <strong>new</strong>:",
                link: { label: 'Changelog', href: 'https://dialx.ai' },
              },
            ]
          : undefined,
      );
      const result = await service.getClientConfig(ctx);

      expect(result.config.announcements).toHaveLength(1);
      const [item] = result.config.announcements;
      expect(item.title).toBe('We have upgraded to DIAL 1.43');
      expect(item.description).toContain('<strong>new</strong>');
      expect(item.link).toEqual({
        label: 'Changelog',
        href: 'https://dialx.ai',
      });
    });

    it('keeps an announcement that carries no link', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [{ title: 'Maintenance window on Friday' }]
          : undefined,
      );
      const result = await service.getClientConfig(ctx);

      expect(result.config.announcements).toHaveLength(1);
      expect(result.config.announcements[0].link).toBeNull();
      expect(result.config.announcements[0].description).toBeNull();
    });

    it.each([
      ['javascript:alert(1)'],
      ['data:text/html,x'],
      ['/settings'],
      ['not a url'],
    ])('drops an announcement whose link href is %s', async (href) => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [{ title: 'Bad link', link: { label: 'Go', href } }]
          : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcements).toEqual([]);
    });

    it('drops an announcement whose link label is blank', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [
              {
                title: 'No label',
                link: { label: '  ', href: 'https://x.dev' },
              },
            ]
          : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcements).toEqual([]);
    });

    it('drops an announcement with a blank or missing title', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [{ title: '   ' }, { description: 'orphan' }]
          : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcements).toEqual([]);
    });

    it('keeps the valid announcements when one entry is rejected', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [
              { title: 'Good', link: { label: 'Go', href: 'https://x.dev' } },
              { title: 'Bad', link: { label: 'Go', href: 'javascript:x' } },
            ]
          : undefined,
      );
      const result = await service.getClientConfig(ctx);

      expect(result.config.announcements).toHaveLength(1);
      expect(result.config.announcements[0].title).toBe('Good');
    });

    it('preserves the configured order of announcements', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [{ title: 'First' }, { title: 'Second' }, { title: 'Third' }]
          : undefined,
      );
      const result = await service.getClientConfig(ctx);

      expect(result.config.announcements.map((item) => item.title)).toEqual([
        'First',
        'Second',
        'Third',
      ]);
    });

    it('sanitizes announcement descriptions', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [
              {
                title: 'Heads up',
                description: '<script>alert(1)</script>Hello',
              },
            ]
          : undefined,
      );
      const result = await service.getClientConfig(ctx);

      const description = result.config.announcements[0].description ?? '';
      expect(description).not.toContain('<script');
      expect(description).toContain('Hello');
    });

    it('nulls an announcement description that sanitizes away entirely', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [{ title: 'Heads up', description: '<script>alert(1)</script>' }]
          : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcements[0].description).toBeNull();
    });

    it('does not treat an announcement title as markup', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [{ title: 'Release <b>3.0</b>' }]
          : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.announcements[0].title).toBe('Release <b>3.0</b>');
    });

    it('degrades to an empty list when ANNOUNCEMENTS is not an array', async () => {
      const { service } = makeService(async (key: string) => {
        if (key === 'announcement.items') return { title: 'x' };
        if (key === 'announcement.title') return 'Banner still works';
        return undefined;
      });
      const result = await service.getClientConfig(ctx);

      expect(result.config.announcements).toEqual([]);
      expect(result.config.announcementTitle).toBe('Banner still works');
    });

    it('caps the announcements list and keeps the leading entries', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? Array.from({ length: 15 }, (_, index) => ({
              title: `Announcement ${index}`,
            }))
          : undefined,
      );
      const result = await service.getClientConfig(ctx);

      expect(result.config.announcements).toHaveLength(10);
      expect(result.config.announcements[0].title).toBe('Announcement 0');
      expect(result.config.announcements[9].title).toBe('Announcement 9');
    });

    it('logs a single exact warning and returns an empty list when ANNOUNCEMENTS resolves to a non-array value', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items' ? { title: 'x' } : undefined,
      );
      const warnSpy = vi
        .spyOn(
          (service as never as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const result = await service.getClientConfig(ctx);

      expect(result.config.announcements).toEqual([]);
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(
        'ANNOUNCEMENTS did not resolve to an array; ignoring it',
      );
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
    ])(
      'returns an empty list with no warning when ANNOUNCEMENTS resolves to %s',
      async (_label, value) => {
        const { service } = makeService(async (key: string) =>
          key === 'announcement.items' ? value : undefined,
        );
        const warnSpy = vi
          .spyOn(
            (service as never as { logger: { warn: () => void } }).logger,
            'warn',
          )
          .mockImplementation(() => undefined);

        const result = await service.getClientConfig(ctx);

        expect(result.config.announcements).toEqual([]);
        expect(warnSpy).not.toHaveBeenCalled();
      },
    );

    it('logs the exact warning text for a non-object announcement entry', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items' ? ['not-an-object'] : undefined,
      );
      const warnSpy = vi
        .spyOn(
          (service as never as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const result = await service.getClientConfig(ctx);

      expect(result.config.announcements).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        'Ignoring announcement entry that is not an object',
      );
    });

    it('logs the exact warning text for a blank or missing title', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items' ? [{ title: '   ' }] : undefined,
      );
      const warnSpy = vi
        .spyOn(
          (service as never as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const result = await service.getClientConfig(ctx);

      expect(result.config.announcements).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        'Ignoring announcement entry with a blank or missing title',
      );
    });

    it('logs the exact warning text for a blank link label', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [
              {
                title: 'No label',
                link: { label: '  ', href: 'https://x.dev' },
              },
            ]
          : undefined,
      );
      const warnSpy = vi
        .spyOn(
          (service as never as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const result = await service.getClientConfig(ctx);

      expect(result.config.announcements).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        'Ignoring announcement "No label": link.label is blank or missing',
      );
    });

    it('logs the exact warning text for an invalid link href', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [{ title: 'Bad link', link: { label: 'Go', href: '/settings' } }]
          : undefined,
      );
      const warnSpy = vi
        .spyOn(
          (service as never as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const result = await service.getClientConfig(ctx);

      expect(result.config.announcements).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        'Ignoring announcement "Bad link": link.href is not an http(s) URL: /settings',
      );
    });

    it('preserves duplicate announcements rather than deduplicating them', async () => {
      const entry = {
        title: 'Same announcement',
        description: 'Same body',
        link: { label: 'Go', href: 'https://x.dev' },
      };
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items' ? [entry, { ...entry }] : undefined,
      );
      const result = await service.getClientConfig(ctx);

      expect(result.config.announcements).toHaveLength(2);
      expect(result.config.announcements[0]).toEqual(
        result.config.announcements[1],
      );
    });

    it('logs a rejection warning for an invalid entry positioned beyond the cap', async () => {
      const validEntries = Array.from({ length: 10 }, (_, index) => ({
        title: `Announcement ${index}`,
      }));
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [...validEntries, { title: '   ' }]
          : undefined,
      );
      const warnSpy = vi
        .spyOn(
          (service as never as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const result = await service.getClientConfig(ctx);

      expect(result.config.announcements).toHaveLength(10);
      expect(warnSpy).toHaveBeenCalledWith(
        'Ignoring announcement entry with a blank or missing title',
      );
    });

    it('logs the cap-exceeded warning last, reporting the total number of valid entries', async () => {
      const validEntries = Array.from({ length: 12 }, (_, index) => ({
        title: `Announcement ${index}`,
      }));
      const { service } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [...validEntries, { title: '   ' }]
          : undefined,
      );
      const warnSpy = vi
        .spyOn(
          (service as never as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const result = await service.getClientConfig(ctx);

      expect(result.config.announcements).toHaveLength(10);
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenNthCalledWith(
        1,
        'Ignoring announcement entry with a blank or missing title',
      );
      expect(warnSpy).toHaveBeenNthCalledWith(
        2,
        'ANNOUNCEMENTS carried 12 entries; keeping the first 10 and dropping the rest',
      );
    });

    it('returns empty string for footerHtmlMessage when FOOTER_HTML_MESSAGE is not set', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.getClientConfig(ctx);
      expect(result.config.footerHtmlMessage).toBe('');
    });

    it('sanitizes footerHtmlMessage and strips disallowed tags', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'footer.html'
          ? '<p>Hello <script>alert(1)</script><span>world</span></p>'
          : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.footerHtmlMessage).not.toContain('<script>');
      expect(result.config.footerHtmlMessage).toContain('<span>world</span>');
    });

    it('strips onclick and other event-handler attributes from footerHtmlMessage', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'footer.html'
          ? '<span onclick="evil()">Click me</span>'
          : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.footerHtmlMessage).not.toContain('onclick');
      expect(result.config.footerHtmlMessage).toContain('Click me');
    });

    it('injects target="_blank" and rel="noopener noreferrer" on anchor tags in footerHtmlMessage', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'footer.html'
          ? '<a href="https://example.com">Link</a>'
          : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.footerHtmlMessage).toContain('target="_blank"');
      expect(result.config.footerHtmlMessage).toContain(
        'rel="noopener noreferrer"',
      );
    });

    it('strips data-dial-action attribute from anchors in footerHtmlMessage', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'footer.html'
          ? '<a href="#" data-dial-action="requestApiKey">Request</a>'
          : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.footerHtmlMessage).not.toContain('data-dial-action');
    });

    it('substitutes %%VERSION%% token in footerHtmlMessage', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'footer.html' ? 'Version: %%VERSION%%' : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.footerHtmlMessage).toBe(
        `Version: ${PACKAGE_VERSION}`,
      );
      expect(result.config.footerHtmlMessage).not.toContain('%%VERSION%%');
    });

    it('substitutes %%VERSION%% with the operator-configured version', async () => {
      const { service } = makeService(async (key: string) => {
        if (key === 'footer.html') return 'Version: %%VERSION%%';
        if (key === 'app.version') return '2026.08.10-a1b2c3d';
        return undefined;
      });
      const result = await service.getClientConfig(ctx);

      expect(result.config.footerHtmlMessage).toBe(
        'Version: 2026.08.10-a1b2c3d',
      );
      expect(result.config.appVersion).toBe('2026.08.10-a1b2c3d');
    });

    it('returns the operator-configured appVersion', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'app.version' ? '2026.08.10-a1b2c3d' : undefined,
      );
      const result = await service.getClientConfig(ctx);

      expect(result.config.appVersion).toBe('2026.08.10-a1b2c3d');
    });

    it('falls back to the package version when appVersion is unset', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.getClientConfig(ctx);

      expect(result.config.appVersion).toBe(PACKAGE_VERSION);
    });

    it('falls back to the package version when appVersion is blank', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'app.version' ? '   ' : undefined,
      );
      const result = await service.getClientConfig(ctx);

      expect(result.config.appVersion).toBe(PACKAGE_VERSION);
    });

    it('trims surrounding whitespace from appVersion', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'app.version' ? '  0.45.0  ' : undefined,
      );
      const result = await service.getClientConfig(ctx);

      expect(result.config.appVersion).toBe('0.45.0');
    });

    it('returns the same appVersion regardless of user roles', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'app.version' ? '0.45.0' : undefined,
      );

      const roleless = await service.getClientConfig({
        appId: 'chat-ui',
        userId: 'user-1',
      });
      const admin = await service.getClientConfig({
        appId: 'chat-ui',
        userId: 'user-2',
        roles: ['admin'],
      });

      expect(roleless.config.appVersion).toBe('0.45.0');
      expect(admin.config.appVersion).toBe('0.45.0');
    });

    it('never leaks the internal DIAL_CORE_URL value under any key', async () => {
      const { service } = makeService(async (key: string) => {
        if (key === 'dialCore.externalUrl') return undefined;
        return undefined;
      });
      const result = await service.getClientConfig(ctx);
      const serialized = JSON.stringify(result);

      expect(serialized).not.toContain('DIAL_CORE_URL');
    });

    it('includes metadata with resolvedAt and cacheTtlSeconds', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.getClientConfig(ctx);

      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata?.resolvedAt).toBe('string');
      expect(result.metadata?.cacheTtlSeconds).toBe(60);
    });

    it('caches resolved config for the same user and roles', async () => {
      const { service, cacheManager, compositeProvider } = makeService(
        async () => undefined,
      );

      const first = await service.getClientConfig({
        appId: 'chat-ui',
        userId: 'user-1',
        roles: ['viewer', 'admin'],
      });
      const second = await service.getClientConfig({
        appId: 'chat-ui',
        userId: 'user-1',
        roles: ['admin', 'viewer'],
      });

      expect(second).toEqual(first);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'app-config:client:chat-ui:user:user-1:roles:admin,viewer',
        first,
        60_000,
      );
      expect(compositeProvider.resolve).toHaveBeenCalledTimes(
        CLIENT_DEFINITIONS_COUNT,
      );
    });

    it('does not share cached config across role sets', async () => {
      const { service, compositeProvider } = makeService(async () => undefined);

      await service.getClientConfig({
        appId: 'chat-ui',
        userId: 'user-1',
        roles: ['admin'],
      });
      await service.getClientConfig({
        appId: 'chat-ui',
        userId: 'user-1',
        roles: ['viewer'],
      });

      expect(compositeProvider.resolve).toHaveBeenCalledTimes(
        CLIENT_DEFINITIONS_COUNT * 2,
      );
    });

    it('serves a cache hit without re-resolving providers or emitting new enabledUiFeatures warnings', async () => {
      const { service, compositeProvider } = makeService(async (key: string) =>
        key === 'uiFeatures.enabledUiFeatures'
          ? ['likes', 'not-a-real-feature']
          : undefined,
      );
      const warnSpy = vi
        .spyOn(
          (service as never as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const first = await service.getClientConfig(ctx);
      warnSpy.mockClear();
      const resolveCallsAfterFirst = (
        compositeProvider.resolve as never as {
          mock: { calls: unknown[] };
        }
      ).mock.calls.length;

      const second = await service.getClientConfig(ctx);

      expect(second).toEqual(first);
      expect(second.config.enabledUiFeatures).toEqual(['likes']);
      expect(compositeProvider.resolve).toHaveBeenCalledTimes(
        resolveCallsAfterFirst,
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('serves a cache hit without re-resolving providers or emitting new announcement warnings', async () => {
      const { service, compositeProvider } = makeService(async (key: string) =>
        key === 'announcement.items'
          ? [{ title: 'Good' }, { title: '   ' }]
          : undefined,
      );
      const warnSpy = vi
        .spyOn(
          (service as never as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const first = await service.getClientConfig(ctx);
      warnSpy.mockClear();
      const resolveCallsAfterFirst = (
        compositeProvider.resolve as never as {
          mock: { calls: unknown[] };
        }
      ).mock.calls.length;

      const second = await service.getClientConfig(ctx);

      expect(second).toEqual(first);
      expect(second.config.announcements).toHaveLength(1);
      expect(compositeProvider.resolve).toHaveBeenCalledTimes(
        resolveCallsAfterFirst,
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('isEnabled', () => {
    it('returns false when provider returns undefined (fail closed)', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.isEnabled(FeatureKey.AsrEnabled, ctx);
      expect(result).toBe(false);
    });

    it('returns true when feature is enabled', async () => {
      const { service } = makeService(async () => true);
      const result = await service.isEnabled(FeatureKey.AsrEnabled, ctx);
      expect(result).toBe(true);
    });

    it('returns false when provider throws (fail closed)', async () => {
      const { service } = makeService(async () => {
        throw new Error('provider failure');
      });
      const result = await service.isEnabled(FeatureKey.AsrEnabled, ctx);
      expect(result).toBe(false);
    });

    it('throws BadRequestException for a config-type key', async () => {
      const { service } = makeService(async () => undefined);
      await expect(
        service.isEnabled('asr.modelId' as FeatureKey, ctx),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolveValue', () => {
    it('delegates to CompositeConfigProvider', async () => {
      const compositeProvider = {
        resolve: vi.fn(async () => 'test-value'),
      } as unknown as CompositeConfigProvider;
      const service = new AppConfigService(
        compositeProvider,
        {
          get: vi.fn(),
          set: vi.fn(),
        } as never,
        new ConfigService(),
      );

      const result = await service.resolveValue('asr.modelId', ctx);

      expect(result).toBe('test-value');
      expect(compositeProvider.resolve).toHaveBeenCalledWith(
        'asr.modelId',
        ctx,
      );
    });
  });
});
