import {
  DEFAULT_PROJECT_CONTEXT_ALLOWED_EXTENSIONS,
  DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES,
  DEFAULT_PROJECT_CONTEXT_TOTAL_MAX_BYTES,
} from '../../projects/constants/project-context.constants';
import type { ConfigDefinition } from '../app-config.types';
import { AnnouncementSeverity } from '../dto/announcement-severity.enum';
import {
  localOnlyKey,
  managedConfigKey,
  managedFeatureKey,
} from '../managed-config/key-management';
import {
  LocalOnlyReason,
  ManagedSchemaType,
  type ManagedValueSchema,
} from '../managed-config/managed-config.types';
import {
  CELEBRATION_DELIVERY_REVISION_PATTERN,
  CELEBRATION_EVENT_ID_PATTERN,
  CELEBRATION_ID_MAX_LENGTH,
  CELEBRATION_POLICY_MAX_ENTRIES,
  CELEBRATION_SCENE_PAIR_MAX_LENGTH,
  CELEBRATION_SCENE_PAIR_PATTERN,
  CelebrationDeliveryMode,
} from '../types/celebration-delivery';
import { FILE_MANAGER_ALLOWED_TABS } from '../types/file-manager-tabs';
import { OnboardingHintTarget } from '../types/onboarding-hint-target';
import { SpendingLimitsMode } from '../types/spending-limits-mode';

/* Non-blank: at least one non-whitespace character. */
const NON_BLANK_PATTERN = '\\S';
/* The id allowlist of `onboarding-hints.normalizer.ts`. */
const ONBOARDING_HINT_ID_PATTERN = '^[A-Za-z0-9._-]{1,64}$';

const boundedText = (
  maxLength: number,
  annotations: Pick<ManagedValueSchema, 'title' | 'description'> & {
    readonly order?: number;
  } = {},
): ManagedValueSchema => ({
  type: ManagedSchemaType.String,
  minLength: 1,
  maxLength,
  pattern: NON_BLANK_PATTERN,
  ...(annotations.title === undefined ? {} : { title: annotations.title }),
  ...(annotations.description === undefined
    ? {}
    : { description: annotations.description }),
  ...(annotations.order === undefined
    ? {}
    : { 'dial:meta': { 'dial:propertyOrder': annotations.order } }),
});

/* Mirrors `normalizeOnboardingHints`: at most 50 hints of
 * { id, target, title, description? }. The target enum is every
 * OnboardingHintTarget value, so a new anchor changes the generated schema and
 * needs a new schema version. Unique ids cannot be expressed in JSON Schema;
 * Chat keeps the first hint with an id and drops the rest with a warning.
 *
 * Unchanged since schema 1.0.0. */
const ONBOARDING_HINTS_SCHEMA: ManagedValueSchema = {
  type: ManagedSchemaType.Array,
  maxItems: 50,
  items: {
    type: ManagedSchemaType.Object,
    additionalProperties: false,
    required: ['id', 'target', 'title'],
    properties: {
      id: {
        type: ManagedSchemaType.String,
        minLength: 1,
        maxLength: 64,
        pattern: ONBOARDING_HINT_ID_PATTERN,
        title: 'ID',
        description:
          'Letters, digits, dot, underscore or hyphen, at most 64. Each browser remembers the ids it has shown, so a new id shows the hint again to everyone; editing the text or the order does not. When two hints share an id, only the first is shown.',
        'dial:meta': { 'dial:propertyOrder': 1 },
      },
      target: {
        type: ManagedSchemaType.String,
        enum: Object.values(OnboardingHintTarget),
        title: 'Target',
        description:
          'The on-screen element the hint points at. The tour skips a hint whose element is not on the current page and shows it on a page that renders it.',
        'dial:meta': { 'dial:propertyOrder': 2 },
      },
      title: boundedText(100, { title: 'Title', order: 3 }),
      description: {
        type: ManagedSchemaType.String,
        maxLength: 500,
        title: 'Description',
        description: 'Optional plain text below the title.',
        'dial:meta': { 'dial:propertyOrder': 4 },
      },
    },
  },
};

/* Schema 1.1.0: the announcement banner, its list and the celebrations. */

/* Both sanitizers (`sanitizeAnnouncementHtml` on the server, DOMPurify in the
 * banner) keep exactly these tags. */
const ANNOUNCEMENT_HTML_HELP =
  'HTML: bold (<b>, <strong>), italic (<em>), line break (<br>), <span> and links (<a href>). Everything else is removed, and a link keeps only its address, target and rel; links to other pages open in a new tab.';
/* Mirrors `isExternalHttpUrl` in `announcements.normalizer.ts`, stricter: a
 * lowercase scheme and no whitespace. A value the pattern accepts but `URL`
 * cannot parse is dropped by the normalizer with a warning, as from ENV. */
const ANNOUNCEMENT_LINK_HREF_PATTERN = '^https?://\\S+$';

/* Mirrors `normalizeAnnouncements`: at most 10 entries of
 * { title, description?, link?: { label, href }, severity? }. */
const ANNOUNCEMENT_ITEMS_SCHEMA: ManagedValueSchema = {
  type: ManagedSchemaType.Array,
  maxItems: 10,
  items: {
    type: ManagedSchemaType.Object,
    additionalProperties: false,
    required: ['title'],
    properties: {
      title: boundedText(200, {
        title: 'Title',
        description: 'Plain text; markup is shown as typed.',
        order: 1,
      }),
      description: {
        type: ManagedSchemaType.String,
        maxLength: 2000,
        title: 'Description',
        description: `Optional. ${ANNOUNCEMENT_HTML_HELP}`,
        'dial:meta': { 'dial:propertyOrder': 2 },
      },
      link: {
        type: ManagedSchemaType.Object,
        additionalProperties: false,
        required: ['label', 'href'],
        title: 'Link',
        description: 'Optional call to action shown after the description.',
        properties: {
          label: boundedText(100, { title: 'Label', order: 1 }),
          href: {
            type: ManagedSchemaType.String,
            maxLength: 2048,
            pattern: ANNOUNCEMENT_LINK_HREF_PATTERN,
            title: 'Address',
            description:
              'An http:// or https:// address. It opens in a new tab.',
            'dial:meta': { 'dial:propertyOrder': 2 },
          },
        },
        'dial:meta': { 'dial:propertyOrder': 3 },
      },
      severity: {
        type: ManagedSchemaType.String,
        enum: Object.values(AnnouncementSeverity),
        title: 'Severity',
        description: 'warning highlights the entry; info is the default.',
        'dial:meta': { 'dial:propertyOrder': 4 },
      },
    },
  },
};

/* Schema 1.2.0: the welcome text, the File Manager tabs, the usage limits and
 * the usage-limits control, the first managed feature. */

/* Mirrors `admitFileManagerTabs`, stricter: known ids only, no repeats. The
 * value is a set: `normalizeFileManagerTabs` emits the fixed tab order and
 * falls back to every tab when no source tab is listed. */
const FILE_MANAGER_TABS_SCHEMA: ManagedValueSchema = {
  type: ManagedSchemaType.Array,
  minItems: 1,
  maxItems: FILE_MANAGER_ALLOWED_TABS.length,
  uniqueItems: true,
  items: { type: ManagedSchemaType.String, enum: FILE_MANAGER_ALLOWED_TABS },
};

const CELEBRATION_EVENT_ID_SCHEMA: ManagedValueSchema = {
  type: ManagedSchemaType.String,
  maxLength: CELEBRATION_ID_MAX_LENGTH,
  pattern: CELEBRATION_EVENT_ID_PATTERN,
};

/* The shape ENV produces after admission: "eventId/sceneId" strings, which
 * `toExternalScenes` splits without re-validating. */
const CELEBRATION_EXTERNAL_SCENES_SCHEMA: ManagedValueSchema = {
  type: ManagedSchemaType.Array,
  maxItems: CELEBRATION_POLICY_MAX_ENTRIES,
  uniqueItems: true,
  items: {
    type: ManagedSchemaType.String,
    maxLength: CELEBRATION_SCENE_PAIR_MAX_LENGTH,
    pattern: CELEBRATION_SCENE_PAIR_PATTERN,
  },
};

const CELEBRATION_EXTERNAL_EVENTS_SCHEMA: ManagedValueSchema = {
  type: ManagedSchemaType.Array,
  maxItems: CELEBRATION_POLICY_MAX_ENTRIES,
  uniqueItems: true,
  items: CELEBRATION_EVENT_ID_SCHEMA,
};

export const CONFIG_DEFINITIONS: ConfigDefinition[] = [
  {
    key: 'asr.modelId',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'Deployment ID of the ASR model used for transcription. Null when ASR_MODEL is not configured.',
    owner: 'chat-team',
    envVar: 'ASR_MODEL',
    management: localOnlyKey(LocalOnlyReason.Capability),
  },
  {
    key: 'asr.transcribeSizeLimitBytes',
    type: 'config',
    valueType: 'number',
    visibility: 'client',
    defaultValue: 5 * 1024 * 1024,
    critical: false,
    description:
      'Maximum audio file size in bytes accepted by the transcription endpoint.',
    owner: 'chat-team',
    envVar: 'TRANSCRIBE_SIZE_LIMIT_BYTES',
    management: localOnlyKey(LocalOnlyReason.BackendEnforcedLimit),
  },
  {
    key: 'customVariables',
    type: 'config',
    valueType: 'json',
    visibility: 'client',
    defaultValue: {},
    critical: false,
    description:
      'Public, client-owned configuration values. Keys have no BFF-defined semantics.',
    owner: 'chat-team',
    envVar: 'CUSTOM_CLIENT_VARIABLES',
    management: localOnlyKey(LocalOnlyReason.Opaque),
  },
  {
    key: 'deployments.defaultDeploymentId',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'Operator-configured default deployment ID shown to users without a persisted selection. Null when DEFAULT_DEPLOYMENT is not set.',
    owner: 'chat-team',
    envVar: 'DEFAULT_DEPLOYMENT',
  },
  {
    key: 'dialCore.externalUrl',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'Public-facing DIAL Core base URL that browsers can reach directly, used to build client-side MCP endpoint links. Null when DIAL_CORE_EXTERNAL_URL is not configured. Distinct from the internal DIAL_CORE_URL, which is never exposed to clients.',
    owner: 'chat-team',
    envVar: 'DIAL_CORE_EXTERNAL_URL',
    management: localOnlyKey(LocalOnlyReason.DeploymentTopology),
  },
  {
    key: 'mcpApps.sandboxUrl',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'Isolated-origin URL of the deployed MCP Apps sandbox-proxy app (apps/mcp-app-sandbox). Null when MCP_APP_SANDBOX_URL is not configured — the "Open App" trigger and auto-open simply do not appear.',
    owner: 'chat-team',
    envVar: 'MCP_APP_SANDBOX_URL',
    management: localOnlyKey(LocalOnlyReason.DeploymentTopology),
  },
  {
    key: 'mcpApps.theme',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'Admin-controlled color theme override for all MCP App Views. When set, all users receive this theme in hostContext.theme regardless of their own UI preference. Null when MCP_APP_THEME is not configured — each client falls back to its own active theme.',
    owner: 'chat-team',
    envVar: 'MCP_APP_THEME',
  },
  {
    key: 'mcpApps.userAgent',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      "Host application identifier sent to MCP App Views in hostContext.userAgent. When MCP_APP_USER_AGENT is not configured, the client falls back to the browser's navigator.userAgent.",
    owner: 'chat-team',
    envVar: 'MCP_APP_USER_AGENT',
  },
  {
    key: 'mcpApps.hostName',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'Host application identifier sent to every mounted MCP App as hostInfo.name during its ui/initialize handshake. Null when MCP_APP_HOST_NAME is not configured — the client falls back to its own default identity.',
    owner: 'chat-team',
    envVar: 'MCP_APP_HOST_NAME',
  },
  {
    key: 'app.version',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'Version string shown in the footer version label and substituted for the %%VERSION%% footer token. Sourced from CHAT_VERSION so CI/CD can stamp the deployed build; falls back to the workspace root package.json version — the one the release pipeline stamps — when unset or blank.',
    owner: 'chat-team',
    envVar: 'CHAT_VERSION',
    management: localOnlyKey(LocalOnlyReason.BuildMetadata),
  },
  {
    key: 'announcement.html',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'Operator-authored HTML announcement message shown in a dismissible top-of-app banner. Passed through verbatim and sanitized client-side to <a>, <b>, <strong>, <em>, <u>, <br>, <span>, <p>; style attributes are stripped. Null/empty hides the banner. Sourced from ANNOUNCEMENT_HTML_MESSAGE.',
    owner: 'chat-team',
    envVar: 'ANNOUNCEMENT_HTML_MESSAGE',
    management: localOnlyKey(LocalOnlyReason.SecurityPolicy),
  },
  {
    key: 'announcement.title',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'Operator-authored plain-text heading shown in bold at the start of the announcement banner line. Rendered as text, never as markup. Null/blank omits the heading. Sourced from ANNOUNCEMENT_TITLE.',
    owner: 'chat-team',
    envVar: 'ANNOUNCEMENT_TITLE',
    management: managedConfigKey({
      title: 'Banner title',
      description:
        'Plain text in bold at the start of the announcement banner; markup is shown as typed. Omit it for a banner without a heading.',
      order: 1,
      value: boundedText(200),
    }),
  },
  {
    key: 'announcement.description',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'Operator-authored supporting copy shown after the announcement banner title. Sanitized server-side to a safe HTML subset. Null/blank omits the description. Sourced from ANNOUNCEMENT_DESCRIPTION.',
    owner: 'chat-team',
    envVar: 'ANNOUNCEMENT_DESCRIPTION',
    management: managedConfigKey({
      title: 'Banner text',
      description: `Shown after the banner title. ${ANNOUNCEMENT_HTML_HELP}`,
      order: 2,
      value: boundedText(2000),
    }),
  },
  {
    key: 'announcement.items',
    type: 'config',
    valueType: 'json',
    visibility: 'client',
    defaultValue: [],
    critical: false,
    description:
      'List of announcements shown in the popover behind the banner\'s "+N announcements" pill. JSON array of { title, description?, link?: { label, href } }. Entries with a blank title, or with a link whose label is blank or whose href is not http/https, are dropped with a warning. Empty (pill hidden) when ANNOUNCEMENTS is unset or malformed; boot never fails on bad config.',
    owner: 'chat-team',
    envVar: 'ANNOUNCEMENTS',
    management: managedConfigKey({
      title: 'Announcements',
      description:
        'Listed, in this order, behind the banner\'s "+N announcements" pill; at most 10. An entry whose link address cannot be opened is dropped.',
      order: 3,
      value: ANNOUNCEMENT_ITEMS_SCHEMA,
    }),
  },
  {
    key: 'onboarding.hints',
    type: 'config',
    valueType: 'json',
    visibility: 'client',
    defaultValue: [],
    critical: false,
    description:
      'Onboarding hints shown once, step by step, to a user who has not seen them. JSON array of { id, target, title, description?, pages? }; target is one of the anchors listed in docs/onboarding-anchors.md; pages limits the hint to those OnboardingHintPage names (home only when unset; unknown names are dropped with a warning). Entries with an invalid or duplicate id, an unknown target or a blank title are dropped with a warning. Empty (no tour) when ONBOARDING_HINTS is unset or malformed; boot never fails on bad config.',
    owner: 'chat-team',
    envVar: 'ONBOARDING_HINTS',
    management: managedConfigKey({
      title: 'Onboarding tour',
      description:
        'Hints shown one at a time, in this order, to users who have not seen them. Each points at an on-screen element; at most 50. A hint whose id repeats an earlier one is dropped.',
      order: 15,
      value: ONBOARDING_HINTS_SCHEMA,
    }),
  },
  {
    key: 'welcomeScreen.description',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'Operator-authored plain-text copy shown below the greeting heading on the new-chat start screen. Rendered as text, never as markup. Null/blank hides it. Sourced from WELCOME_SCREEN_DESCRIPTION.',
    owner: 'chat-team',
    envVar: 'WELCOME_SCREEN_DESCRIPTION',
    management: managedConfigKey({
      title: 'Welcome text',
      description:
        'Plain text below the greeting on the new-chat screen; markup is shown as typed.',
      order: 10,
      value: boundedText(1000),
    }),
  },
  {
    key: 'footer.html',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'Operator-authored HTML footer message shown below the chat input (desktop) and in the mobile user panel. Null/empty hides the footer. Sourced from FOOTER_HTML_MESSAGE. Supports %%VERSION%% token substitution.',
    owner: 'chat-team',
    envVar: 'FOOTER_HTML_MESSAGE',
  },
  {
    key: 'features.footer',
    type: 'feature',
    valueType: 'boolean',
    visibility: 'client',
    defaultValue: false,
    critical: false,
    description:
      'Whether the footer HTML message area is shown. Automatically enabled when FOOTER_HTML_MESSAGE is set.',
    owner: 'chat-team',
    management: localOnlyKey(LocalOnlyReason.Derived),
  },
  {
    key: 'features.asrEnabled',
    type: 'feature',
    valueType: 'boolean',
    visibility: 'client',
    defaultValue: false,
    critical: false,
    description:
      'Whether ASR (Automatic Speech Recognition) transcription is enabled. Derived from ASR_MODEL presence. Set ASR_ENABLED_ROLES to restrict to specific roles.',
    owner: 'chat-team',
    allowedRolesEnvVar: 'ASR_ENABLED_ROLES',
    management: localOnlyKey(LocalOnlyReason.Capability),
  },
  {
    key: 'utility.modelId',
    type: 'config',
    valueType: 'string',
    visibility: 'server',
    defaultValue: null,
    critical: false,
    description:
      'Deployment ID of the utility model used for server-side tasks such as LLM conversation naming. Null when UTILITY_MODEL is not configured.',
    owner: 'chat-team',
    envVar: 'UTILITY_MODEL',
    management: localOnlyKey(LocalOnlyReason.Capability),
  },
  {
    key: 'analytics.url',
    type: 'config',
    valueType: 'string',
    visibility: 'server',
    defaultValue: null,
    critical: false,
    description:
      "Base URL of DIAL Analytics (ADAS), read by GET /api/v1/user/usage/history with the caller's own token. Null when ANALYTICS_URL is not configured, which turns the route off (it answers not_configured). Never exposed to the frontend client-config endpoint (visibility: server).",
    owner: 'chat-team',
    envVar: 'ANALYTICS_URL',
    management: localOnlyKey(LocalOnlyReason.DeploymentTopology),
  },
  {
    key: 'analytics.timeoutMs',
    type: 'config',
    valueType: 'number',
    visibility: 'server',
    defaultValue: 10_000,
    critical: false,
    description:
      'Timeout in milliseconds of each DIAL Analytics call made for one usage-history request. No retries. Never exposed to the frontend client-config endpoint (visibility: server).',
    owner: 'chat-team',
    envVar: 'ANALYTICS_TIMEOUT_MS',
    management: localOnlyKey(LocalOnlyReason.Capability),
  },
  {
    key: 'features.llmConversationNaming',
    type: 'feature',
    valueType: 'boolean',
    visibility: 'server',
    defaultValue: false,
    critical: false,
    description:
      'Whether LLM-based conversation naming runs after the first assistant reply. Derived from UTILITY_MODEL and DIAL_API_KEY presence plus LLM_CONVERSATION_NAMING_ENABLED=true.',
    owner: 'chat-team',
    management: localOnlyKey(LocalOnlyReason.Capability),
  },
  {
    key: 'features.responsesApiEnabled',
    type: 'feature',
    valueType: 'boolean',
    visibility: 'server',
    defaultValue: false,
    critical: false,
    description:
      'Server-side kill switch for routing eligible generations through the OpenAI Responses API. Even when a deployment reports features.responsesApi=true, Responses is only used when this flag is also true. Defaults to false. Not exposed to the frontend client-config endpoint (visibility: server). Role-based rollout (RESPONSES_API_ENABLED_ROLES) is not implemented — out of scope.',
    owner: 'chat-team',
    envVar: 'RESPONSES_API_ENABLED',
    management: localOnlyKey(LocalOnlyReason.Capability),
  },
  {
    key: 'features.responsesBackgroundEnabled',
    type: 'feature',
    valueType: 'boolean',
    visibility: 'server',
    defaultValue: false,
    critical: false,
    description:
      'Server-side switch for starting eligible Responses generations as DIAL Core background jobs (background: true, store: true). Requires features.responsesApiEnabled, the deployment capability features.responsesApi, and "openaiResponses" in the deployment interfaces. Affects only how new generations start: in-flight background jobs stay recoverable, stoppable and finalizable when it is off. Defaults to false. Not exposed to the frontend client-config endpoint (visibility: server). Requires DIAL Core >= 0.48.0.',
    owner: 'chat-team',
    envVar: 'RESPONSES_BACKGROUND_ENABLED',
    management: localOnlyKey(LocalOnlyReason.Capability),
  },
  {
    key: 'ui.activeEventId',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'Active start-page celebration module ID selected by UI_EVENT. Missing or none disables celebrations. The frontend owns the event registry and ignores IDs it does not support; adding an event does not require a backend enum change.',
    owner: 'chat-team',
    envVar: 'UI_EVENT',
    management: managedConfigKey({
      title: 'Celebration event',
      description:
        'The seasonal celebration shown on the start page: halloween or new-year, or none to turn celebrations off. An event without a built-in module plays only when it is listed under external events and its pack is available; an unknown event shows nothing.',
      order: 20,
      value: CELEBRATION_EVENT_ID_SCHEMA,
    }),
  },
  {
    key: 'ui.celebrationsEnabledByDefault',
    type: 'config',
    valueType: 'boolean',
    visibility: 'client',
    defaultValue: true,
    critical: false,
    description:
      'Operator default for the seasonal-celebrations switch in Settings → Preferences, applied to users who have not saved a choice of their own; a saved choice overrides it. On by default; only false, 0 or no turns it off. Has no visible effect without ui.activeEventId.',
    owner: 'chat-team',
    envVar: 'UI_EVENT_ENABLED_BY_DEFAULT',
    management: managedConfigKey({
      title: 'Celebrations on by default',
      description:
        'Whether users who never changed the celebrations switch in Settings see the celebration event. A choice a user saved always wins.',
      order: 21,
      value: { type: ManagedSchemaType.Boolean },
    }),
  },
  {
    key: 'ui.celebrationDelivery.mode',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: CelebrationDeliveryMode.Bundled,
    critical: false,
    description:
      'Where celebration scenes come from: bundled (compiled scenes only, no celebration request) or prefer-external (allowlisted scenes and admitted events from external packs served by /api/v1/celebrations). Sourced from UI_EVENT_DELIVERY_MODE; bundled by default.',
    owner: 'chat-team',
    envVar: 'UI_EVENT_DELIVERY_MODE',
    management: managedConfigKey({
      title: 'Celebration scene source',
      description:
        'For built-in events: bundled plays only built-in scenes; prefer-external also takes the scenes listed under Scenes from packs from the celebration packs this deployment serves, and keeps the built-in scenes when a pack is unavailable. External events come from their pack either way.',
      order: 22,
      value: {
        type: ManagedSchemaType.String,
        enum: Object.values(CelebrationDeliveryMode),
      },
    }),
  },
  {
    key: 'ui.celebrationDelivery.revision',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: '0',
    critical: false,
    description:
      'Operator revision of the celebration delivery policy; a change restarts a playing scene. Sourced from UI_EVENT_DELIVERY_REVISION; "0" by default.',
    owner: 'chat-team',
    envVar: 'UI_EVENT_DELIVERY_REVISION',
    management: managedConfigKey({
      title: 'Celebration restart token',
      description:
        'Change it to restart a scene that is already playing; changing the event, the source or the allowed scenes restarts it anyway. 1–64 letters, digits, dot, dash or underscore.',
      order: 23,
      value: {
        type: ManagedSchemaType.String,
        maxLength: CELEBRATION_ID_MAX_LENGTH,
        pattern: CELEBRATION_DELIVERY_REVISION_PATTERN,
      },
    }),
  },
  {
    key: 'ui.celebrationDelivery.externalScenes',
    type: 'config',
    valueType: 'json',
    visibility: 'client',
    defaultValue: [],
    critical: false,
    description:
      'Scenes of compiled celebration events that may come from an external pack, as eventId/sceneId pairs. Sourced from UI_EVENT_EXTERNAL_SCENES (comma-separated, at most 64); empty by default.',
    owner: 'chat-team',
    envVar: 'UI_EVENT_EXTERNAL_SCENES',
    management: managedConfigKey({
      title: 'Scenes from packs',
      description:
        'Scenes of built-in events that may come from a celebration pack, each as eventId/sceneId, for example new-year/snowman-delivery; at most 64. Used only when the scene source is prefer-external.',
      order: 24,
      value: CELEBRATION_EXTERNAL_SCENES_SCHEMA,
    }),
  },
  {
    key: 'ui.celebrationDelivery.externalEvents',
    type: 'config',
    valueType: 'json',
    visibility: 'client',
    defaultValue: [],
    critical: false,
    description:
      'Celebration event IDs without a compiled module that may come entirely from an external pack. Sourced from UI_EVENT_EXTERNAL_EVENTS (comma-separated, at most 64); empty by default.',
    owner: 'chat-team',
    envVar: 'UI_EVENT_EXTERNAL_EVENTS',
    management: managedConfigKey({
      title: 'External events',
      description:
        'Events without a built-in module that may come entirely from a celebration pack this deployment serves, for example company-anniversary; at most 64. An external event that is selected but not listed here shows nothing.',
      order: 25,
      value: CELEBRATION_EXTERNAL_EVENTS_SCHEMA,
    }),
  },
  {
    key: 'overlay.enabled',
    type: 'config',
    valueType: 'boolean',
    visibility: 'client',
    defaultValue: false,
    critical: false,
    description:
      'Whether the chat-overlay embedded runtime mode is reachable. Distinct from ALLOWED_IFRAME_ORIGINS: has no effect unless at least one origin is also allowlisted there.',
    owner: 'chat-team',
    envVar: 'OVERLAY_ENABLED',
    management: localOnlyKey(LocalOnlyReason.SecurityPolicy),
  },
  {
    key: 'documents.allowedConnectOrigins',
    type: 'config',
    valueType: 'json',
    visibility: 'client',
    defaultValue: [],
    critical: false,
    description:
      'External connection origins permitted by CSP. PDF previews may use browser credentials for matching HTTP(S) origins.',
    owner: 'chat-team',
    envVar: 'ALLOWED_CONNECT_ORIGINS',
    management: localOnlyKey(LocalOnlyReason.SecurityPolicy),
  },
  {
    key: 'overlay.allowedOrigins',
    type: 'config',
    valueType: 'json',
    visibility: 'client',
    defaultValue: [],
    critical: false,
    description:
      'Host origins allowed to embed this app, exposed to the client for self-diagnosis. Sourced from ALLOWED_IFRAME_ORIGINS, the same list that drives CSP frame-ancestors/frame-src.',
    owner: 'chat-team',
    envVar: 'ALLOWED_IFRAME_ORIGINS',
    management: localOnlyKey(LocalOnlyReason.SecurityPolicy),
  },
  {
    key: 'fileManager.availableTabs',
    type: 'config',
    valueType: 'json',
    visibility: 'client',
    defaultValue: ['all', 'my_files', 'shared', 'organization'],
    critical: false,
    description:
      'Which File Manager tabs are shown to users, normalized by normalizeFileManagerTabs into the fixed tab order. Defaults to the All tab plus the three source tabs when FILE_MANAGER_AVAILABLE_TABS is unset, resolves to no valid ids or lists no source tab.',
    owner: 'chat-team',
    envVar: 'FILE_MANAGER_AVAILABLE_TABS',
    management: managedConfigKey({
      title: 'File Manager tabs',
      description:
        'Which File Manager tabs users see. Tabs always appear in the order All, My files, Shared, Organization; the order here does not matter. All appears only with at least two other tabs.',
      order: 30,
      value: FILE_MANAGER_TABS_SCHEMA,
    }),
  },
  {
    key: 'features.liveChatInteraction',
    type: 'feature',
    valueType: 'boolean',
    visibility: 'client',
    defaultValue: false,
    critical: false,
    description:
      'Whether the chat app subscribes to the DIAL Core client channel and shows the ' +
      'interactive toolset sign-in dialog when a completion needs mid-stream toolset ' +
      'credentials. Set LIVE_CHAT_INTERACTION_ENABLED_ROLES to restrict to specific roles.',
    owner: 'chat-team',
    envVar: 'LIVE_CHAT_INTERACTION_ENABLED',
    allowedRolesEnvVar: 'LIVE_CHAT_INTERACTION_ENABLED_ROLES',
    management: localOnlyKey(LocalOnlyReason.Capability),
  },
  {
    key: 'features.scheduledTasksEnabled',
    type: 'feature',
    valueType: 'boolean',
    visibility: 'client',
    defaultValue: false,
    critical: false,
    description:
      'Whether the Scheduled Tasks feature is enabled, including the DIAL Scheduler ' +
      'proxy endpoints, the Scheduled Tasks page, and its sidebar navigation entry. ' +
      'Set SCHEDULED_TASKS_ENABLED_ROLES to restrict to specific roles.',
    owner: 'chat-team',
    envVar: 'SCHEDULED_TASKS_ENABLED',
    allowedRolesEnvVar: 'SCHEDULED_TASKS_ENABLED_ROLES',
    management: localOnlyKey(LocalOnlyReason.Capability),
  },
  {
    key: 'features.projectsEnabled',
    type: 'feature',
    valueType: 'boolean',
    visibility: 'client',
    defaultValue: false,
    critical: false,
    description:
      'Whether the Projects feature is enabled, including the GET /api/v1/projects ' +
      'listing endpoint, the Projects page, and its sidebar navigation entry. ' +
      'Set PROJECTS_ENABLED_ROLES to restrict to specific roles.',
    owner: 'chat-team',
    envVar: 'PROJECTS_ENABLED',
    allowedRolesEnvVar: 'PROJECTS_ENABLED_ROLES',
  },
  {
    key: 'features.defaultDeploymentPinned',
    type: 'feature',
    valueType: 'boolean',
    visibility: 'client',
    defaultValue: false,
    critical: false,
    description:
      'When enabled, the operator-configured DEFAULT_DEPLOYMENT is pinned to position 0 ' +
      'in the deployment picker and takes priority over the user-persisted model preference ' +
      'when resolving the initial selection for a new chat.',
    owner: 'chat-team',
    envVar: 'DEFAULT_DEPLOYMENT_PINNED',
  },
  {
    key: 'features.visualizerSendMessages',
    type: 'feature',
    valueType: 'boolean',
    visibility: 'client',
    defaultValue: false,
    critical: false,
    description:
      'When enabled, a custom or application visualizer iframe may post ' +
      '`SEND_MESSAGE` to send its text as a user message in the conversation ' +
      'that renders it. Off by default; port of the legacy ALLOW_VISUALIZER_SEND_MESSAGES.',
    owner: 'chat-team',
    envVar: 'ALLOW_VISUALIZER_SEND_MESSAGES',
    management: localOnlyKey(LocalOnlyReason.SecurityPolicy),
  },
  {
    key: 'features.usageLimitsControl',
    type: 'feature',
    valueType: 'boolean',
    visibility: 'client',
    defaultValue: false,
    critical: false,
    description:
      'Whether the conversation input shows the token/cost usage-limits control ' +
      'next to the model selector. Off by default.',
    owner: 'chat-team',
    envVar: 'USAGE_LIMITS_CONTROL_ENABLED',
    management: managedFeatureKey({
      title: 'Usage-limits control',
      description:
        'Shows the token and cost usage-limits control next to the model selector.',
      order: 1,
    }),
  },
  {
    key: 'features.orgUnitsEnabled',
    type: 'feature',
    valueType: 'boolean',
    visibility: 'client',
    defaultValue: false,
    critical: false,
    description:
      'Whether the chat reads the DIAL Core org units to tell which public ' +
      'folders are units. Off by default.',
    owner: 'chat-team',
    envVar: 'ORG_UNITS_ENABLED',
    management: localOnlyKey(LocalOnlyReason.Capability),
  },
  {
    key: 'uiFeatures.enabledUiFeatures',
    type: 'config',
    valueType: 'json',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'When set, the complete list of OverlayFeature values that are enabled (replace semantics). Replaces DEFAULT_ENABLED_UI_FEATURES entirely — includes both positive and Hide* modifier flags. When not set (null), the compiled-in DEFAULT_ENABLED_UI_FEATURES baseline is used. Does not affect an overlay host that supplies its own enabledFeatures — that replaces the active set entirely.',
    owner: 'chat-team',
    envVar: 'ENABLED_UI_FEATURES',
  },
  {
    key: 'customVisualizers',
    type: 'config',
    valueType: 'json',
    visibility: 'client',
    defaultValue: [],
    critical: false,
    description:
      'Registry of MIME type → visualizer iframe URL mappings. An attachment whose MIME type matches an entry opens in the AttachmentCanvas rendered by that visualizer instead of the default preview. The origin of each entry URL must also be listed in ALLOWED_IFRAME_ORIGINS, which is the sole source of CSP frame-src; otherwise the browser blocks the iframe. Empty (feature dark) when CUSTOM_VISUALIZERS is unset. Invalid JSON or invalid entries are dropped with an error log; boot never fails on malformed config.',
    owner: 'chat-team',
    envVar: 'CUSTOM_VISUALIZERS',
    management: localOnlyKey(LocalOnlyReason.SecurityPolicy),
  },
  {
    key: 'applicationVisualizers',
    type: 'config',
    valueType: 'json',
    visibility: 'client',
    defaultValue: {},
    critical: false,
    description:
      'Registry of application id → grouped visualizer mappings, keyed by the effective deployment id of a message. Every attachment the entry claims is delivered to one iframe together via SEND_GROUPED_VISUALIZE_DATA, rendered inline in the message with an expand-to-canvas control. An entry may declare a comma-separated contentType to claim only those MIME types; when it is omitted, every attachment carrying a URL is claimed, and unclaimed attachments render as ordinary tiles. Takes precedence over CUSTOM_VISUALIZERS for the attachments it claims. The origin of each entry URL must also be listed in ALLOWED_IFRAME_ORIGINS, which is the sole source of CSP frame-src; otherwise the browser blocks the iframe. Empty (feature dark) when APPLICATION_VISUALIZERS is unset. Invalid JSON, a non-object value, or invalid entries are dropped with an error log; boot never fails on malformed config.',
    owner: 'chat-team',
    envVar: 'APPLICATION_VISUALIZERS',
    management: localOnlyKey(LocalOnlyReason.SecurityPolicy),
  },
  {
    key: 'publish.publicationFilterSources',
    type: 'config',
    valueType: 'json',
    visibility: 'client',
    defaultValue: ['title', 'role', 'dial_roles'],
    critical: false,
    description:
      "Allowed claim/category names selectable as a publication access rule's source. Sourced from PUBLICATION_FILTER_SOURCES (comma-separated); falls back to the legacy default when unset or empty.",
    owner: 'chat-team',
    envVar: 'PUBLICATION_FILTER_SOURCES',
    management: localOnlyKey(LocalOnlyReason.Capability),
  },
  {
    key: 'content.additionalLocales',
    type: 'config',
    valueType: 'json',
    visibility: 'client',
    defaultValue: [],
    critical: false,
    description:
      "Additional content locales (BCP-47 tags) a toolset's or application's Name/Description can be translated into. Sourced from ADDITIONAL_CONTENT_LOCALES (comma-separated); when that is absent, the deprecated AVAILABLE_LOCALES is read. Canonicalised and de-duplicated; the frontend drops the primary locale.",
    owner: 'chat-team',
    envVar: 'ADDITIONAL_CONTENT_LOCALES',
  },
  {
    key: 'attachments.maxFileSizeBytes',
    type: 'config',
    valueType: 'number',
    visibility: 'client',
    defaultValue: 536_870_912,
    critical: false,
    description:
      'Maximum attachment/upload file size in bytes, surfaced to the client so it can reject an oversized file before attempting to upload it. Sourced from FILE_UPLOAD_MAX_BYTES — the same variable that already bounds the POST /api/v1/files Multer limit — so the frontend pre-check and the backend enforcement can never diverge.',
    owner: 'chat-team',
    envVar: 'FILE_UPLOAD_MAX_BYTES',
    management: localOnlyKey(LocalOnlyReason.BackendEnforcedLimit),
  },
  {
    key: 'projects.contextFileMaxBytes',
    type: 'config',
    valueType: 'number',
    visibility: 'client',
    defaultValue: DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES,
    critical: false,
    description:
      'Maximum size in bytes of one project context file. Sourced from PROJECT_CONTEXT_FILE_MAX_BYTES, the same variable POST /api/v1/projects enforces, so the New project form rejects an oversized file before uploading it.',
    owner: 'chat-team',
    envVar: 'PROJECT_CONTEXT_FILE_MAX_BYTES',
    management: localOnlyKey(LocalOnlyReason.BackendEnforcedLimit),
  },
  {
    key: 'projects.contextTotalMaxBytes',
    type: 'config',
    valueType: 'number',
    visibility: 'client',
    defaultValue: DEFAULT_PROJECT_CONTEXT_TOTAL_MAX_BYTES,
    critical: false,
    description:
      "Maximum combined size in bytes of a project's context files — the New project form's capacity. Sourced from PROJECT_CONTEXT_TOTAL_MAX_BYTES, which POST /api/v1/projects enforces.",
    owner: 'chat-team',
    envVar: 'PROJECT_CONTEXT_TOTAL_MAX_BYTES',
    management: localOnlyKey(LocalOnlyReason.BackendEnforcedLimit),
  },
  {
    key: 'projects.contextAllowedExtensions',
    type: 'config',
    valueType: 'json',
    visibility: 'client',
    defaultValue: [...DEFAULT_PROJECT_CONTEXT_ALLOWED_EXTENSIONS],
    critical: false,
    description:
      'Lower-case file extensions, without a dot, accepted as project context files. Sourced from PROJECT_CONTEXT_ALLOWED_EXTENSIONS, which POST /api/v1/projects enforces.',
    owner: 'chat-team',
    envVar: 'PROJECT_CONTEXT_ALLOWED_EXTENSIONS',
    management: localOnlyKey(LocalOnlyReason.BackendEnforcedLimit),
  },
  {
    key: 'usageLimits.warningThresholdPercent',
    type: 'config',
    valueType: 'number',
    visibility: 'client',
    defaultValue: 75,
    critical: false,
    description:
      'Percentage (1–99) of a capped day/week/month token or cost limit at which the composer shows its usage banner above the input. Governs the banner only — the usage dial and the Settings → Usage page keep their fixed 75% running-low mark.',
    owner: 'chat-team',
    envVar: 'USAGE_LIMITS_WARNING_THRESHOLD_PERCENT',
    management: managedConfigKey({
      title: 'Usage warning threshold (%)',
      description:
        'Share of a capped day, week or month limit at which the usage banner appears above the message box. The usage dial and the Usage page keep their own 75% mark.',
      order: 40,
      value: { type: ManagedSchemaType.Integer, minimum: 1, maximum: 99 },
    }),
  },
  {
    key: 'usageLimits.spendingLimitsMode',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: SpendingLimitsMode.Off,
    critical: false,
    description:
      "DIAL Core's spendingLimits.mode (off, shadow or enforce), which DIAL Core does not report to the caller. Decides whether Settings → Usage shows the caller's budgets, and whether the Usage page, the usage banner and the usage dial present the role cost limit (off, shadow) or only the budgets (enforce). Must equal DIAL Core's value; off by default.",
    owner: 'chat-team',
    envVar: 'SPENDING_LIMITS_MODE',
    management: managedConfigKey({
      title: 'Spending limits mode',
      description:
        "Must equal DIAL Core's spending-limits mode. off: budgets are hidden. shadow: budgets are shown as not yet enforced. enforce: only budgets are shown. It changes what Chat shows, not what DIAL Core enforces.",
      order: 41,
      value: {
        type: ManagedSchemaType.String,
        enum: Object.values(SpendingLimitsMode),
      },
    }),
  },
];
