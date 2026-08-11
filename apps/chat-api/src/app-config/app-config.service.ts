import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import packageJson from '../../package.json';
import type { AppConfigEvalContext } from './app-config.types';
import { CompositeConfigProvider } from './config-registry/composite-config.provider';
import { CONFIG_DEFINITIONS } from './config-registry/config-registry.constants';
import type {
  AnnouncementItemDto,
  AnnouncementLinkDto,
} from './dto/announcement-item.dto';
import type { ClientConfigResponseDto } from './dto/client-config-response.dto';
import type { CustomVisualizerDto } from './dto/custom-visualizer.dto';
import { FeatureKey } from './feature-flags/feature-key.enum';
import { sanitizeAnnouncementHtml, sanitizeFooterHtml } from './html-sanitizer';
import { KNOWN_UI_FEATURES } from './known-ui-features.constants';

const CACHE_TTL_SECONDS = 60;
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;
const DEFAULT_FILE_MANAGER_TABS = ['my_files', 'shared', 'organization'];
const DEFAULT_PUBLICATION_FILTER_SOURCES = ['title', 'role', 'dial_roles'];

const APP_VERSION: string = packageJson?.version;

/* Blank and whitespace-only operator values are treated as "unset" so the
 * banner never reserves space for an empty string. */
const toNullableText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const MAX_ANNOUNCEMENTS = 10;

/* Parsed rather than prefix-matched, so "JaVaScRiPt:" and whitespace-padded
 * schemes are caught too. Relative URLs are rejected on purpose: operator
 * config must not be able to point at an in-app route. */
const isExternalHttpUrl = (href: string): boolean => {
  try {
    const { protocol } = new URL(href);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

type AnnouncementRejection = { reason: string };

const parseAnnouncementLink = (
  raw: unknown,
): AnnouncementLinkDto | null | AnnouncementRejection => {
  /* No link at all is valid — an announcement may be purely informational. */
  if (raw == null) {
    return null;
  }
  if (typeof raw !== 'object') {
    return { reason: 'link is not an object' };
  }

  const { label, href } = raw as Record<string, unknown>;
  const parsedLabel = toNullableText(label);
  if (!parsedLabel) {
    return { reason: 'link.label is blank or missing' };
  }
  if (typeof href !== 'string' || !isExternalHttpUrl(href.trim())) {
    return { reason: `link.href is not an http(s) URL: ${String(href)}` };
  }

  return { label: parsedLabel, href: href.trim() };
};

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(
    private readonly compositeProvider: CompositeConfigProvider,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Normalizes the operator-authored announcements list. Bad entries are
   * dropped with a warning rather than throwing: a typo in a Helm values file
   * must never take down `/api/v1/client-config`.
   */
  private normalizeAnnouncements(resolved: unknown): AnnouncementItemDto[] {
    if (!Array.isArray(resolved)) {
      if (resolved != null) {
        this.logger.warn(
          'ANNOUNCEMENTS did not resolve to an array; ignoring it',
        );
      }
      return [];
    }

    const items: AnnouncementItemDto[] = [];

    for (const entry of resolved) {
      if (entry == null || typeof entry !== 'object') {
        this.logger.warn('Ignoring announcement entry that is not an object');
        continue;
      }

      const { title, description, link } = entry as Record<string, unknown>;

      const parsedTitle = toNullableText(title);
      if (!parsedTitle) {
        this.logger.warn(
          'Ignoring announcement entry with a blank or missing title',
        );
        continue;
      }

      const parsedLink = parseAnnouncementLink(link);
      if (parsedLink && 'reason' in parsedLink) {
        /* Dropping the whole entry, not just the link: a row that still looks
         * right but silently lost its call to action is worse than a missing
         * row, because nobody notices it. */
        this.logger.warn(
          `Ignoring announcement "${parsedTitle}": ${parsedLink.reason}`,
        );
        continue;
      }

      const rawDescription = toNullableText(description);

      items.push({
        title: parsedTitle,
        description: rawDescription
          ? sanitizeAnnouncementHtml(rawDescription)
          : null,
        link: parsedLink,
      });
    }

    if (items.length > MAX_ANNOUNCEMENTS) {
      this.logger.warn(
        `ANNOUNCEMENTS carried ${items.length} entries; keeping the first ${MAX_ANNOUNCEMENTS} and dropping the rest`,
      );
      return items.slice(0, MAX_ANNOUNCEMENTS);
    }

    return items;
  }

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
    const appVersion = await this.resolveAppVersion(context);

    const clientDefinitions = CONFIG_DEFINITIONS.filter(
      (d) => d.visibility === 'client' && d.key !== 'app.version',
    );

    const features: Record<string, boolean> = {};
    let asrModelId: string | null = null;
    let transcribeSizeLimitBytes = 5 * 1024 * 1024;
    let defaultDeploymentId: string | null = null;
    let dialCoreExternalUrl: string | null = null;
    let fileManagerTabs: string[] = DEFAULT_FILE_MANAGER_TABS;
    let overlayEnabled = false;
    let overlayAllowedOrigins: string[] = [];
    let enabledUiFeatures: string[] | null = null;
    let announcementHtml: string | null = null;
    let announcementTitle: string | null = null;
    let announcementDescription: string | null = null;
    let announcements: AnnouncementItemDto[] = [];
    let deepResearchToolId: string | null = null;
    let footerHtmlMessage = '';
    let customVisualizers: CustomVisualizerDto[] = [];
    let publicationFilterSources: string[] = DEFAULT_PUBLICATION_FILTER_SOURCES;

    for (const def of clientDefinitions) {
      const value = await this.compositeProvider.resolve(def.key, context);
      const resolved = value ?? def.defaultValue;

      if (def.type === 'feature') {
        // Strip the 'features.' prefix to get the short feature key name
        const shortKey = def.key.startsWith('features.')
          ? def.key.slice('features.'.length)
          : def.key;
        features[shortKey] = resolved === true;
      } else if (def.key === 'asr.modelId') {
        asrModelId = typeof resolved === 'string' ? resolved : null;
      } else if (def.key === 'asr.transcribeSizeLimitBytes') {
        transcribeSizeLimitBytes =
          typeof resolved === 'number' ? resolved : 5 * 1024 * 1024;
      } else if (def.key === 'deployments.defaultDeploymentId') {
        defaultDeploymentId = typeof resolved === 'string' ? resolved : null;
      } else if (def.key === 'deployments.deepResearchToolId') {
        deepResearchToolId = typeof resolved === 'string' ? resolved : null;
      } else if (def.key === 'dialCore.externalUrl') {
        dialCoreExternalUrl = typeof resolved === 'string' ? resolved : null;
      } else if (def.key === 'fileManager.availableTabs') {
        fileManagerTabs = Array.isArray(resolved)
          ? resolved
          : DEFAULT_FILE_MANAGER_TABS;
      } else if (def.key === 'overlay.enabled') {
        overlayEnabled = resolved === true;
      } else if (def.key === 'overlay.allowedOrigins') {
        overlayAllowedOrigins = Array.isArray(resolved) ? resolved : [];
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
        announcements = this.normalizeAnnouncements(resolved);
      } else if (def.key === 'footer.html') {
        footerHtmlMessage =
          typeof resolved === 'string'
            ? sanitizeFooterHtml(resolved, appVersion)
            : '';
      } else if (def.key === 'uiFeatures.enabledUiFeatures') {
        const rawValue = Array.isArray(resolved) ? resolved : [];
        if (rawValue.length > 0) {
          const filtered = rawValue.filter((entry) => {
            const isKnown = KNOWN_UI_FEATURES.has(entry);
            if (!isKnown) {
              this.logger.warn(
                `Ignoring unrecognized ENABLED_UI_FEATURES entry: "${String(entry)}"`,
              );
            }
            return isKnown;
          });
          if (filtered.length > 0) {
            enabledUiFeatures = filtered;
          } else {
            this.logger.warn(
              'ENABLED_UI_FEATURES contained only unrecognized entries; falling back to compiled-in defaults',
            );
          }
        }
      } else if (def.key === 'customVisualizers') {
        customVisualizers = Array.isArray(resolved) ? resolved : [];
      } else if (def.key === 'publish.publicationFilterSources') {
        publicationFilterSources = Array.isArray(resolved)
          ? resolved
          : DEFAULT_PUBLICATION_FILTER_SOURCES;
      }
    }

    const response: ClientConfigResponseDto = {
      appId: context.appId,
      features,
      config: {
        appVersion,
        asrModelId,
        transcribeSizeLimitBytes,
        defaultDeploymentId,
        dialCoreExternalUrl,
        fileManagerTabs,
        overlayEnabled,
        overlayAllowedOrigins,
        announcementHtml,
        announcementTitle,
        announcementDescription,
        announcements,
        footerHtmlMessage,
        enabledUiFeatures,
        deepResearchToolId,
        customVisualizers,
        publicationFilterSources,
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
   * Resolves the version string shown to clients. `CHAT_VERSION` wins so a
   * CI/CD pipeline can stamp the deployed build; a missing or blank value falls
   * back to the bundled package.json version, so the result is never empty.
   */
  private async resolveAppVersion(
    context: AppConfigEvalContext,
  ): Promise<string> {
    const resolved = await this.compositeProvider.resolve(
      'app.version',
      context,
    );
    if (typeof resolved === 'string' && resolved.trim().length > 0) {
      return resolved.trim();
    }
    return APP_VERSION;
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
