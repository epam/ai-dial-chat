import { normalizeAnnouncements } from './announcements.normalizer';
import type { ApplicationVisualizerDto } from './dto/application-visualizer.dto';
import type { ClientConfigDto } from './dto/client-config-response.dto';
import { normalizeEnabledUiFeatures } from './enabled-ui-features.normalizer';
import { sanitizeAnnouncementHtml, sanitizeFooterHtml } from './html-sanitizer';
import { toNullableText } from './text.util';

const DEFAULT_TRANSCRIBE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_ATTACHMENT_FILE_SIZE_BYTES = 536_870_912;
const DEFAULT_FILE_MANAGER_TABS: readonly string[] = [
  'my_files',
  'shared',
  'organization',
];
const DEFAULT_PUBLICATION_FILTER_SOURCES: readonly string[] = [
  'title',
  'role',
  'dial_roles',
];

/**
 * The `config` fields of the client-config response that are derived from a
 * single registry key. `appVersion` (resolved ahead of the loop) and
 * `aiTextRefinementAvailable` (read from `ConfigService`) are assembled by
 * `AppConfigService` itself. `Required` keeps `allowedConnectOrigins`, which is
 * optional in the DTO, always present, as the response has always emitted it.
 */
export type MappedClientConfig = Required<
  Omit<ClientConfigDto, 'aiTextRefinementAvailable' | 'appVersion'>
>;

/**
 * What a mapping entry receives: the registry key's value after
 * `value ?? definition.defaultValue`, the version already resolved for this
 * request (for `%%VERSION%%` in the footer), and the service's warning callback
 * for the normalizers.
 */
export interface ClientConfigMappingInput {
  resolved: unknown;
  appVersion: string;
  warn: (message: string) => void;
}

export interface ClientConfigMapping {
  readonly field: keyof MappedClientConfig;
  readonly apply: (
    config: MappedClientConfig,
    input: ClientConfigMappingInput,
  ) => void;
}

/* Ties each entry to one field so the compiler checks the converter's return
 * type against that field's DTO type without a cast. */
const defineMapping = <K extends keyof MappedClientConfig>(
  field: K,
  convert: (input: ClientConfigMappingInput) => MappedClientConfig[K],
): ClientConfigMapping => ({
  field,
  apply: (config, input) => {
    config[field] = convert(input);
  },
});

const toNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

/* The provider already validated every entry, so this only has to reject the
 * shapes that are not a registry at all — an array included, since
 * `typeof [] === 'object'`. */
const isApplicationVisualizerRegistry = (
  value: unknown,
): value is Record<string, ApplicationVisualizerDto> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCustomVariables = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Returns a fresh accumulator holding every mapped field's default, so no
 * response ever shares a default array or object with another one. Property
 * order is the response's `config` key order, after `aiTextRefinementAvailable`
 * and `appVersion`.
 */
export const createDefaultClientConfig = (): MappedClientConfig => ({
  activeEventId: null,
  asrModelId: null,
  transcribeSizeLimitBytes: DEFAULT_TRANSCRIBE_SIZE_LIMIT_BYTES,
  defaultDeploymentId: null,
  dialCoreExternalUrl: null,
  mcpAppSandboxUrl: null,
  mcpAppTheme: null,
  mcpAppUserAgent: null,
  mcpAppHostName: null,
  fileManagerTabs: [...DEFAULT_FILE_MANAGER_TABS],
  overlayEnabled: false,
  overlayAllowedOrigins: [],
  allowedConnectOrigins: [],
  announcementHtml: null,
  announcementTitle: null,
  announcementDescription: null,
  announcements: [],
  welcomeScreenDescription: null,
  footerHtmlMessage: '',
  enabledUiFeatures: null,
  customVisualizers: [],
  applicationVisualizers: {},
  customVariables: {},
  publicationFilterSources: [...DEFAULT_PUBLICATION_FILTER_SOURCES],
  maxAttachmentFileSizeBytes: DEFAULT_MAX_ATTACHMENT_FILE_SIZE_BYTES,
});

/**
 * One entry per client-visible, non-feature registry key except `app.version`,
 * which `AppConfigService` resolves ahead of the loop. A `Map` rather than an
 * object literal, so a lookup never reaches `Object.prototype`.
 * `tests/client-config.mapper.spec.ts` keeps this table in sync with
 * `CONFIG_DEFINITIONS`.
 */
export const CLIENT_CONFIG_MAPPINGS: ReadonlyMap<string, ClientConfigMapping> =
  new Map<string, ClientConfigMapping>([
    [
      'ui.activeEventId',
      defineMapping('activeEventId', ({ resolved }) =>
        toNullableString(resolved),
      ),
    ],
    [
      'asr.modelId',
      defineMapping('asrModelId', ({ resolved }) => toNullableString(resolved)),
    ],
    [
      'asr.transcribeSizeLimitBytes',
      defineMapping('transcribeSizeLimitBytes', ({ resolved }) =>
        typeof resolved === 'number'
          ? resolved
          : DEFAULT_TRANSCRIBE_SIZE_LIMIT_BYTES,
      ),
    ],
    [
      'deployments.defaultDeploymentId',
      defineMapping('defaultDeploymentId', ({ resolved }) =>
        toNullableString(resolved),
      ),
    ],
    [
      'dialCore.externalUrl',
      defineMapping('dialCoreExternalUrl', ({ resolved }) =>
        toNullableString(resolved),
      ),
    ],
    [
      'mcpApps.sandboxUrl',
      defineMapping('mcpAppSandboxUrl', ({ resolved }) =>
        toNullableString(resolved),
      ),
    ],
    [
      'mcpApps.theme',
      defineMapping('mcpAppTheme', ({ resolved }) =>
        resolved === 'light' || resolved === 'dark' ? resolved : null,
      ),
    ],
    [
      'mcpApps.userAgent',
      defineMapping('mcpAppUserAgent', ({ resolved }) =>
        toNullableString(resolved),
      ),
    ],
    [
      'mcpApps.hostName',
      defineMapping('mcpAppHostName', ({ resolved }) =>
        toNullableString(resolved),
      ),
    ],
    [
      'fileManager.availableTabs',
      defineMapping('fileManagerTabs', ({ resolved }) =>
        Array.isArray(resolved) ? resolved : [...DEFAULT_FILE_MANAGER_TABS],
      ),
    ],
    [
      'overlay.enabled',
      defineMapping('overlayEnabled', ({ resolved }) => resolved === true),
    ],
    [
      'overlay.allowedOrigins',
      defineMapping('overlayAllowedOrigins', ({ resolved }) =>
        Array.isArray(resolved) ? resolved : [],
      ),
    ],
    [
      'documents.allowedConnectOrigins',
      defineMapping('allowedConnectOrigins', ({ resolved }) =>
        Array.isArray(resolved) ? resolved : [],
      ),
    ],
    [
      'announcement.html',
      defineMapping('announcementHtml', ({ resolved }) =>
        toNullableString(resolved),
      ),
    ],
    [
      'announcement.title',
      /* Plain text by contract: never sanitized, never parsed as markup, so
       * an operator writing "<b>" sees those characters in the banner. */
      defineMapping('announcementTitle', ({ resolved }) =>
        toNullableText(resolved),
      ),
    ],
    [
      'announcement.description',
      defineMapping('announcementDescription', ({ resolved }) => {
        const raw = toNullableText(resolved);
        return raw ? sanitizeAnnouncementHtml(raw) : null;
      }),
    ],
    [
      'announcement.items',
      defineMapping('announcements', ({ resolved, warn }) =>
        normalizeAnnouncements(resolved, warn),
      ),
    ],
    [
      'welcomeScreen.description',
      /* Plain text by contract: never sanitized, never parsed as markup. */
      defineMapping('welcomeScreenDescription', ({ resolved }) =>
        toNullableText(resolved),
      ),
    ],
    [
      'footer.html',
      defineMapping('footerHtmlMessage', ({ resolved, appVersion }) =>
        typeof resolved === 'string'
          ? sanitizeFooterHtml(resolved, appVersion)
          : '',
      ),
    ],
    [
      'uiFeatures.enabledUiFeatures',
      defineMapping('enabledUiFeatures', ({ resolved, warn }) =>
        normalizeEnabledUiFeatures(resolved, warn),
      ),
    ],
    [
      'customVariables',
      defineMapping('customVariables', ({ resolved }) =>
        isCustomVariables(resolved) ? resolved : {},
      ),
    ],
    [
      'customVisualizers',
      defineMapping('customVisualizers', ({ resolved }) =>
        Array.isArray(resolved) ? resolved : [],
      ),
    ],
    [
      'applicationVisualizers',
      defineMapping('applicationVisualizers', ({ resolved }) =>
        isApplicationVisualizerRegistry(resolved) ? resolved : {},
      ),
    ],
    [
      'publish.publicationFilterSources',
      defineMapping('publicationFilterSources', ({ resolved }) =>
        Array.isArray(resolved)
          ? resolved
          : [...DEFAULT_PUBLICATION_FILTER_SOURCES],
      ),
    ],
    [
      'attachments.maxFileSizeBytes',
      defineMapping('maxAttachmentFileSizeBytes', ({ resolved }) =>
        typeof resolved === 'number'
          ? resolved
          : DEFAULT_MAX_ATTACHMENT_FILE_SIZE_BYTES,
      ),
    ],
  ]);

/**
 * Writes the field mapped to `key` into `config`. A key without an entry
 * leaves `config` untouched, with no throw and no log, as the previous inline
 * dispatch did.
 */
export const applyClientConfigValue = (
  config: MappedClientConfig,
  key: string,
  input: ClientConfigMappingInput,
): void => {
  CLIENT_CONFIG_MAPPINGS.get(key)?.apply(config, input);
};
