import { BadRequestException } from '@nestjs/common';
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
    service: new AppConfigService(compositeProvider, cacheManager as never),
    cacheManager,
    compositeProvider,
  };
}

describe('AppConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getClientConfig', () => {
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
      expect(result.config.enabledUiFeatures).toBeNull();
      expect(result.config.announcementHtml).toBeNull();
      expect(result.config.footerHtmlMessage).toBe('');
      expect(result.config.customVisualizers).toEqual([]);
      expect(result.config.publicationFilterSources).toEqual([
        'title',
        'role',
        'dial_roles',
      ]);
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
        if (key === 'deployments.deepResearchToolId') return 'deep_research';
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
      expect(result.config.deepResearchToolId).toBe('deep_research');
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

    it('falls back to null (use defaults) when every enabledUiFeatures entry is unrecognized', async () => {
      const { service } = makeService(async (key: string) => {
        if (key === 'uiFeatures.enabledUiFeatures') return ['totally-invalid'];
        return undefined;
      });

      const result = await service.getClientConfig(ctx);

      expect(result.config.enabledUiFeatures).toBeNull();
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

    it('returns null deepResearchToolId when DEEP_RESEARCH_TOOL_ID is not set', async () => {
      const { service } = makeService(async () => undefined);
      const result = await service.getClientConfig(ctx);
      expect(result.config.deepResearchToolId).toBeNull();
    });

    it('returns the configured deepResearchToolId when DEEP_RESEARCH_TOOL_ID is set', async () => {
      const { service } = makeService(async (key: string) =>
        key === 'deployments.deepResearchToolId' ? 'deep_research' : undefined,
      );
      const result = await service.getClientConfig(ctx);
      expect(result.config.deepResearchToolId).toBe('deep_research');
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
      const service = new AppConfigService(compositeProvider, {
        get: vi.fn(),
        set: vi.fn(),
      } as never);

      const result = await service.resolveValue('asr.modelId', ctx);

      expect(result).toBe('test-value');
      expect(compositeProvider.resolve).toHaveBeenCalledWith(
        'asr.modelId',
        ctx,
      );
    });
  });
});
