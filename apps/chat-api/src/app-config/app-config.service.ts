import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import sanitizeHtml from 'sanitize-html';
import packageJson from '../../package.json';
import type { AppConfigEvalContext } from './app-config.types';
import { CompositeConfigProvider } from './config-registry/composite-config.provider';
import { CONFIG_DEFINITIONS } from './config-registry/config-registry.constants';
import type { ClientConfigResponseDto } from './dto/client-config-response.dto';
import { FeatureKey } from './feature-flags/feature-key.enum';
import { KNOWN_UI_FEATURES } from './known-ui-features.constants';

const CACHE_TTL_SECONDS = 60;
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;
const DEFAULT_FILE_MANAGER_TABS = ['my_files', 'shared', 'organization'];

const APP_VERSION: string = packageJson.version;

const FOOTER_ALLOWED_TAGS = ['a', 'span', 'strong', 'u', 'em', 'br', 'p'];
const FOOTER_ALLOWED_ATTRS: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'target', 'rel', 'data-dial-action'],
};

const sanitizeFooterHtml = (raw: string): string => {
  const withVersion = raw.replace(/%%VERSION%%/g, APP_VERSION);
  return sanitizeHtml(withVersion, {
    allowedTags: FOOTER_ALLOWED_TAGS,
    allowedAttributes: FOOTER_ALLOWED_ATTRS,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? '';
        /* Hash links and data-dial-action links are handled client-side; don't force external navigation on them. */
        if (attribs['data-dial-action'] != null || href.startsWith('#')) {
          return { tagName, attribs };
        }
        return {
          tagName,
          attribs: {
            ...attribs,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        };
      },
    },
  });
};

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

    const clientDefinitions = CONFIG_DEFINITIONS.filter(
      (d) => d.visibility === 'client',
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
    let deepResearchToolId: string | null = null;
    let footerHtmlMessage = '';

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
      } else if (def.key === 'footer.html') {
        footerHtmlMessage =
          typeof resolved === 'string' ? sanitizeFooterHtml(resolved) : '';
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
      }
    }

    const response: ClientConfigResponseDto = {
      appId: context.appId,
      features,
      config: {
        asrModelId,
        transcribeSizeLimitBytes,
        defaultDeploymentId,
        dialCoreExternalUrl,
        fileManagerTabs,
        overlayEnabled,
        overlayAllowedOrigins,
        announcementHtml,
        footerHtmlMessage,
        enabledUiFeatures,
        deepResearchToolId,
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
