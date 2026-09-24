import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { resolveAppVersion } from '../common/utils/app-version';
import { normalizeAnnouncements } from './announcements.normalizer';
import type { AppConfigEvalContext } from './app-config.types';
import { CompositeConfigProvider } from './config-registry/composite-config.provider';
import { CONFIG_DEFINITIONS } from './config-registry/config-registry.constants';
import type { AnnouncementItemDto } from './dto/announcement-item.dto';
import type { ApplicationVisualizerDto } from './dto/application-visualizer.dto';
import type { ClientConfigResponseDto } from './dto/client-config-response.dto';
import type { CustomVisualizerDto } from './dto/custom-visualizer.dto';
import { normalizeEnabledUiFeatures } from './enabled-ui-features.normalizer';
import { FeatureKey } from './feature-flags/feature-key.enum';
import { sanitizeAnnouncementHtml, sanitizeFooterHtml } from './html-sanitizer';
import { toNullableText } from './text.util';

const CACHE_TTL_SECONDS = 60;
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;
const DEFAULT_FILE_MANAGER_TABS = ['my_files', 'shared', 'organization'];
const DEFAULT_PUBLICATION_FILTER_SOURCES = ['title', 'role', 'dial_roles'];

/* The provider already validated every entry, so this only has to reject the
 * shapes that are not a registry at all — an array included, since
 * `typeof [] === 'object'`. */
const isApplicationVisualizerRegistry = (
  value: unknown,
): value is Record<string, ApplicationVisualizerDto> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(
    private readonly compositeProvider: CompositeConfigProvider,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async resolveValue(
    key: string,
    context: AppConfigEvalContext,
  ): Promise<unknown | undefined> {
    return this.compositeProvider.resolve(key, context);
  }

  async getClientConfig(
    context: AppConfigEvalContext,
  ): Promise<ClientConfigResponseDto> {
    const cacheKey = this.getClientConfigCacheKey(context);
    const cached =
      await this.cacheManager.get<ClientConfigResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    /* `app.version` is resolved ahead of the loop instead of inside it: both the
     * `appVersion` response field and the `%%VERSION%%` token inside
     * `footer.html` read it, and relying on CONFIG_DEFINITIONS ordering to have
     * it ready would be brittle. It is filtered out below so it is still
     * resolved exactly once per request. */
    const appVersion = await this.resolveConfiguredVersion(context);

    const clientDefinitions = CONFIG_DEFINITIONS.filter(
      (d) => d.visibility === 'client' && d.key !== 'app.version',
    );

    const features: Record<string, boolean> = {};
    let activeEventId: string | null = null;
    let asrModelId: string | null = null;
    let transcribeSizeLimitBytes = 5 * 1024 * 1024;
    let defaultDeploymentId: string | null = null;
    let dialCoreExternalUrl: string | null = null;
    let mcpAppSandboxUrl: string | null = null;
    let mcpAppTheme: 'light' | 'dark' | null = null;
    let mcpAppUserAgent: string | null = null;
    let mcpAppHostName: string | null = null;
    let fileManagerTabs: string[] = DEFAULT_FILE_MANAGER_TABS;
    let overlayEnabled = false;
    let overlayAllowedOrigins: string[] = [];
    let allowedConnectOrigins: string[] = [];
    let enabledUiFeatures: string[] | null = null;
    let announcementHtml: string | null = null;
    let announcementTitle: string | null = null;
    let announcementDescription: string | null = null;
    let announcements: AnnouncementItemDto[] = [];
    let welcomeScreenDescription: string | null = null;
    let footerHtmlMessage = '';
    let customVisualizers: CustomVisualizerDto[] = [];
    let applicationVisualizers: Record<string, ApplicationVisualizerDto> = {};
    let customVariables: Record<string, unknown> = {};
    let publicationFilterSources: string[] = DEFAULT_PUBLICATION_FILTER_SOURCES;
    let maxAttachmentFileSizeBytes = 536_870_912;

    for (const def of clientDefinitions) {
      const value = await this.compositeProvider.resolve(def.key, context);
      const resolved = value ?? def.defaultValue;

      if (def.type === 'feature') {
        // Strip the 'features.' prefix to get the short feature key name
        const shortKey = def.key.startsWith('features.')
          ? def.key.slice('features.'.length)
          : def.key;
        features[shortKey] = resolved === true;
      } else if (def.key === 'ui.activeEventId') {
        activeEventId = typeof resolved === 'string' ? resolved : null;
      } else if (def.key === 'asr.modelId') {
        asrModelId = typeof resolved === 'string' ? resolved : null;
      } else if (def.key === 'asr.transcribeSizeLimitBytes') {
        transcribeSizeLimitBytes =
          typeof resolved === 'number' ? resolved : 5 * 1024 * 1024;
      } else if (def.key === 'deployments.defaultDeploymentId') {
        defaultDeploymentId = typeof resolved === 'string' ? resolved : null;
      } else if (def.key === 'dialCore.externalUrl') {
        dialCoreExternalUrl = typeof resolved === 'string' ? resolved : null;
      } else if (def.key === 'mcpApps.sandboxUrl') {
        mcpAppSandboxUrl = typeof resolved === 'string' ? resolved : null;
      } else if (def.key === 'mcpApps.theme') {
        mcpAppTheme =
          resolved === 'light' || resolved === 'dark' ? resolved : null;
      } else if (def.key === 'mcpApps.userAgent') {
        mcpAppUserAgent = typeof resolved === 'string' ? resolved : null;
      } else if (def.key === 'mcpApps.hostName') {
        mcpAppHostName = typeof resolved === 'string' ? resolved : null;
      } else if (def.key === 'fileManager.availableTabs') {
        fileManagerTabs = Array.isArray(resolved)
          ? resolved
          : DEFAULT_FILE_MANAGER_TABS;
      } else if (def.key === 'overlay.enabled') {
        overlayEnabled = resolved === true;
      } else if (def.key === 'overlay.allowedOrigins') {
        overlayAllowedOrigins = Array.isArray(resolved) ? resolved : [];
      } else if (def.key === 'documents.allowedConnectOrigins') {
        allowedConnectOrigins = Array.isArray(resolved) ? resolved : [];
      } else if (def.key === 'announcement.html') {
        announcementHtml = typeof resolved === 'string' ? resolved : null;
      } else if (def.key === 'announcement.title') {
        /* Plain text by contract: never sanitized, never parsed as markup, so
         * an operator writing "<b>" sees those characters in the banner. */
        announcementTitle = toNullableText(resolved);
      } else if (def.key === 'announcement.description') {
        const raw = toNullableText(resolved);
        announcementDescription = raw ? sanitizeAnnouncementHtml(raw) : null;
      } else if (def.key === 'announcement.items') {
        announcements = normalizeAnnouncements(resolved, (message) =>
          this.logger.warn(message),
        );
      } else if (def.key === 'welcomeScreen.description') {
        /* Plain text by contract: never sanitized, never parsed as markup. */
        welcomeScreenDescription = toNullableText(resolved);
      } else if (def.key === 'footer.html') {
        footerHtmlMessage =
          typeof resolved === 'string'
            ? sanitizeFooterHtml(resolved, appVersion)
            : '';
      } else if (def.key === 'uiFeatures.enabledUiFeatures') {
        enabledUiFeatures = normalizeEnabledUiFeatures(resolved, (message) =>
          this.logger.warn(message),
        );
      } else if (def.key === 'customVariables') {
        customVariables =
          resolved !== null &&
          typeof resolved === 'object' &&
          !Array.isArray(resolved)
            ? (resolved as Record<string, unknown>)
            : {};
      } else if (def.key === 'customVisualizers') {
        customVisualizers = Array.isArray(resolved) ? resolved : [];
      } else if (def.key === 'applicationVisualizers') {
        applicationVisualizers = isApplicationVisualizerRegistry(resolved)
          ? resolved
          : {};
      } else if (def.key === 'publish.publicationFilterSources') {
        publicationFilterSources = Array.isArray(resolved)
          ? resolved
          : DEFAULT_PUBLICATION_FILTER_SOURCES;
      } else if (def.key === 'attachments.maxFileSizeBytes') {
        maxAttachmentFileSizeBytes =
          typeof resolved === 'number' ? resolved : 536_870_912;
      }
    }

    const response: ClientConfigResponseDto = {
      appId: context.appId,
      features,
      config: {
        appVersion,
        activeEventId,
        asrModelId,
        transcribeSizeLimitBytes,
        defaultDeploymentId,
        dialCoreExternalUrl,
        mcpAppSandboxUrl,
        mcpAppTheme,
        mcpAppUserAgent,
        mcpAppHostName,
        fileManagerTabs,
        overlayEnabled,
        overlayAllowedOrigins,
        allowedConnectOrigins,
        announcementHtml,
        announcementTitle,
        announcementDescription,
        announcements,
        welcomeScreenDescription,
        footerHtmlMessage,
        enabledUiFeatures,
        customVisualizers,
        applicationVisualizers,
        customVariables,
        publicationFilterSources,
        maxAttachmentFileSizeBytes,
      },
      metadata: {
        resolvedAt: new Date().toISOString(),
        cacheTtlSeconds: CACHE_TTL_SECONDS,
      },
    };

    await this.cacheManager.set(cacheKey, response, CACHE_TTL_MS);
    return response;
  }

  async isEnabled(
    key: FeatureKey,
    context: AppConfigEvalContext,
  ): Promise<boolean> {
    const definition = CONFIG_DEFINITIONS.find((d) => d.key === key);
    if (!definition) {
      throw new BadRequestException(`Unknown feature key: "${key}"`);
    }
    if (definition.type !== 'feature') {
      throw new BadRequestException(
        `Key "${key}" is of type "${definition.type}", not "feature"`,
      );
    }

    try {
      const value = await this.compositeProvider.resolve(key, context);
      return value === true;
    } catch (err) {
      this.logger.error(
        `Failed to resolve feature key "${key}", failing closed: ${String(err)}`,
      );
      return false;
    }
  }

  /**
   * Resolves the version string shown to clients. The `app.version` key reads
   * `CHAT_VERSION`, so a CI/CD pipeline can stamp the deployed build; the
   * package.json fallback for a missing or blank value lives in
   * `resolveAppVersion`, shared with `GET /health`.
   */
  private async resolveConfiguredVersion(
    context: AppConfigEvalContext,
  ): Promise<string> {
    const resolved = await this.compositeProvider.resolve(
      'app.version',
      context,
    );
    return resolveAppVersion(typeof resolved === 'string' ? resolved : null);
  }

  private getClientConfigCacheKey(context: AppConfigEvalContext): string {
    const appId = encodeURIComponent(context.appId);
    const userId = encodeURIComponent(context.userId ?? 'anonymous');
    const roles =
      [...(context.roles ?? [])]
        .sort()
        .map((role) => encodeURIComponent(role))
        .join(',') || 'none';
    return `app-config:client:${appId}:user:${userId}:roles:${roles}`;
  }
}
