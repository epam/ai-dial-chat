import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../../config/environment.config';
import { ExplicitEnvironment } from '../../../config/explicit-environment';
import { validate } from '../../../config/validation';
import { AppConfigService } from '../../app-config.service';
import type {
  AppConfigEvalContext,
  ConfigDefinition,
} from '../../app-config.types';
import { CLIENT_CONFIG_MAPPINGS } from '../../client-config.mapper';
import { CompositeConfigProvider } from '../../config-registry/composite-config.provider';
import { CONFIG_DEFINITIONS } from '../../config-registry/config-registry.constants';
import { EnvConfigProvider } from '../../config-registry/env-config.provider';
import { StaticDefaultsProvider } from '../../config-registry/static-defaults.provider';
import type { FeatureKey } from '../../feature-flags/feature-key.enum';

/** The variables `validate()` requires; none of them is a registry variable. */
export const REQUIRED_ENV: Readonly<Record<string, string>> = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
};

export const ANONYMOUS: AppConfigEvalContext = { appId: 'chat-ui' };

/** A raw environment as Nest's ConfigModule hands it to `validate()`. */
export type RawEnvironment = Readonly<Record<string, string>>;

export interface ResolutionStack {
  readonly provider: EnvConfigProvider;
  readonly service: AppConfigService;
}

/** What one resolution produced, or the boot error when `validate()` throws. */
export type Outcome =
  | { readonly provider: unknown; readonly effective: unknown }
  | { readonly bootError: string };

const createMemoryCache = () => {
  const store = new Map<string, unknown>();
  return {
    get: async (key: string) => store.get(key),
    set: async (key: string, value: unknown) => {
      store.set(key, value);
    },
  };
};

/**
 * Builds the production resolution chain — `validate()`, `ConfigService`,
 * `EnvConfigProvider`, `CompositeConfigProvider` and `AppConfigService` —
 * from one raw environment, with a fresh cache per stack.
 */
export const buildResolutionStack = (raw: RawEnvironment): ResolutionStack => {
  const validated = validate({ ...REQUIRED_ENV, ...raw });
  const configService = new ConfigService<EnvironmentVariables>(validated);
  const explicitEnvironment =
    ExplicitEnvironment.fromConfigService(configService);
  const provider = new EnvConfigProvider(configService, explicitEnvironment);
  /* Nest calls this at boot; it logs the AVAILABLE_LOCALES deprecation. */
  provider.onModuleInit();
  const composite = new CompositeConfigProvider(
    provider,
    new StaticDefaultsProvider(),
  );
  const service = new AppConfigService(
    composite,
    createMemoryCache() as never,
    configService,
    explicitEnvironment,
  );
  return { provider, service };
};

export const getDefinition = (key: string): ConfigDefinition => {
  const definition = CONFIG_DEFINITIONS.find((entry) => entry.key === key);
  if (!definition) {
    throw new Error(`Unknown registry key ${key}`);
  }
  return definition;
};

const shortFeatureKey = (key: string): string =>
  key.startsWith('features.') ? key.slice('features.'.length) : key;

/**
 * The value a caller observes for `key`:
 * - a feature: `isEnabled`, which must agree with the client-config feature
 *   for client-visible features;
 * - a client config key: its client-config field (or field part);
 * - a server config key: `resolveValue ?? defaultValue`.
 */
export const resolveEffective = async (
  stack: ResolutionStack,
  key: string,
  context: AppConfigEvalContext,
): Promise<unknown> => {
  const definition = getDefinition(key);

  if (definition.type === 'feature') {
    const enabled = await stack.service.isEnabled(key as FeatureKey, context);
    if (definition.visibility === 'client') {
      const response = await stack.service.getClientConfig(context);
      const clientValue = response.features[shortFeatureKey(key)];
      if (clientValue !== enabled) {
        throw new Error(
          `${key}: isEnabled=${String(enabled)} but client-config=${String(clientValue)}`,
        );
      }
    }
    return enabled;
  }

  if (definition.visibility === 'server') {
    return (
      (await stack.service.resolveValue(key, context)) ??
      definition.defaultValue
    );
  }

  const { config } = await stack.service.getClientConfig(context);
  if (key === 'app.version') {
    return config.appVersion;
  }
  const mapping = CLIENT_CONFIG_MAPPINGS.get(key);
  if (!mapping) {
    throw new Error(`No client-config mapping for ${key}`);
  }
  const field: unknown = config[mapping.field];
  return mapping.part
    ? (field as Record<string, unknown>)[mapping.part]
    : field;
};

/**
 * Resolves `key` end to end and then at the provider alone. `readLogs` is
 * called right after the end-to-end pass, so the logs it returns cover boot
 * and one resolution, not the repeated provider call.
 */
export const resolveOutcome = async (
  raw: RawEnvironment,
  key: string,
  context: AppConfigEvalContext = ANONYMOUS,
  readLogs?: () => readonly string[],
): Promise<Outcome & { readonly logs?: readonly string[] }> => {
  let stack: ResolutionStack;
  try {
    stack = buildResolutionStack(raw);
  } catch (error) {
    return {
      bootError: (error as Error).message,
      ...(readLogs ? { logs: [...readLogs()] } : {}),
    };
  }
  const effective = await resolveEffective(stack, key, context);
  const logs = readLogs ? { logs: [...readLogs()] } : {};
  return {
    provider: await stack.provider.resolve(key, context),
    effective,
    ...logs,
  };
};

/**
 * One registry key read through its own variable. `typedDefault` is the raw
 * spelling of the environment class initializer and is present only when the
 * variable declares one.
 */
export interface EnvKeyCase {
  readonly key: string;
  readonly variable: string;
  readonly typedDefault?: string;
  readonly nonDefault: string;
}

export enum EnvCaseName {
  Absent = 'absent',
  TypedDefault = 'typedDefault',
  NonDefault = 'nonDefault',
  Empty = 'empty',
}

/** The raw environment for one case of an `EnvKeyCase`. */
export const envForCase = (
  entry: EnvKeyCase,
  name: EnvCaseName,
): RawEnvironment | undefined => {
  switch (name) {
    case EnvCaseName.Absent:
      return {};
    case EnvCaseName.TypedDefault:
      return entry.typedDefault === undefined
        ? undefined
        : { [entry.variable]: entry.typedDefault };
    case EnvCaseName.NonDefault:
      return { [entry.variable]: entry.nonDefault };
    case EnvCaseName.Empty:
      return { [entry.variable]: '' };
  }
};

/** Every registry key that reads a variable of its own (`envVar`). */
export const ENV_KEY_CASES: readonly EnvKeyCase[] = [
  { key: 'asr.modelId', variable: 'ASR_MODEL', nonDefault: 'whisper-1' },
  {
    key: 'asr.transcribeSizeLimitBytes',
    variable: 'TRANSCRIBE_SIZE_LIMIT_BYTES',
    typedDefault: '5242880',
    nonDefault: '10485760',
  },
  {
    key: 'customVariables',
    variable: 'CUSTOM_CLIENT_VARIABLES',
    nonDefault: '{"label":"Example","count":3}',
  },
  {
    key: 'deployments.defaultDeploymentId',
    variable: 'DEFAULT_DEPLOYMENT',
    nonDefault: 'gpt-4o',
  },
  {
    key: 'dialCore.externalUrl',
    variable: 'DIAL_CORE_EXTERNAL_URL',
    nonDefault: 'https://core.example.com',
  },
  {
    key: 'mcpApps.sandboxUrl',
    variable: 'MCP_APP_SANDBOX_URL',
    nonDefault: 'https://sandbox.example.com',
  },
  { key: 'mcpApps.theme', variable: 'MCP_APP_THEME', nonDefault: 'dark' },
  {
    key: 'mcpApps.userAgent',
    variable: 'MCP_APP_USER_AGENT',
    nonDefault: 'DIAL Chat',
  },
  {
    key: 'mcpApps.hostName',
    variable: 'MCP_APP_HOST_NAME',
    nonDefault: 'dial-chat',
  },
  { key: 'app.version', variable: 'CHAT_VERSION', nonDefault: '9.9.9' },
  {
    key: 'announcement.html',
    variable: 'ANNOUNCEMENT_HTML_MESSAGE',
    nonDefault: '<b>Hello</b>',
  },
  {
    key: 'announcement.title',
    variable: 'ANNOUNCEMENT_TITLE',
    nonDefault: ' Maintenance ',
  },
  {
    key: 'announcement.description',
    variable: 'ANNOUNCEMENT_DESCRIPTION',
    nonDefault: 'Tonight <script>x</script><b>only</b>',
  },
  {
    key: 'announcement.items',
    variable: 'ANNOUNCEMENTS',
    nonDefault:
      '[{"title":"A","link":{"label":"Read","href":"https://a.example.com"}}]',
  },
  {
    key: 'welcomeScreen.description',
    variable: 'WELCOME_SCREEN_DESCRIPTION',
    nonDefault: 'Welcome',
  },
  {
    key: 'footer.html',
    variable: 'FOOTER_HTML_MESSAGE',
    nonDefault: 'Build %%VERSION%%',
  },
  {
    key: 'utility.modelId',
    variable: 'UTILITY_MODEL',
    nonDefault: 'gpt-4o-mini',
  },
  {
    key: 'features.responsesApiEnabled',
    variable: 'RESPONSES_API_ENABLED',
    typedDefault: 'false',
    nonDefault: 'true',
  },
  {
    key: 'features.responsesBackgroundEnabled',
    variable: 'RESPONSES_BACKGROUND_ENABLED',
    typedDefault: 'false',
    nonDefault: 'true',
  },
  { key: 'ui.activeEventId', variable: 'UI_EVENT', nonDefault: 'halloween' },
  {
    key: 'ui.celebrationsEnabledByDefault',
    variable: 'UI_EVENT_ENABLED_BY_DEFAULT',
    typedDefault: 'true',
    nonDefault: 'false',
  },
  {
    key: 'ui.celebrationDelivery.mode',
    variable: 'UI_EVENT_DELIVERY_MODE',
    typedDefault: 'bundled',
    nonDefault: 'prefer-external',
  },
  {
    key: 'ui.celebrationDelivery.revision',
    variable: 'UI_EVENT_DELIVERY_REVISION',
    typedDefault: '0',
    nonDefault: '7',
  },
  {
    key: 'ui.celebrationDelivery.externalScenes',
    variable: 'UI_EVENT_EXTERNAL_SCENES',
    typedDefault: '',
    nonDefault: 'halloween/pumpkin',
  },
  {
    key: 'ui.celebrationDelivery.externalEvents',
    variable: 'UI_EVENT_EXTERNAL_EVENTS',
    typedDefault: '',
    nonDefault: 'diwali',
  },
  {
    key: 'overlay.enabled',
    variable: 'OVERLAY_ENABLED',
    typedDefault: 'false',
    nonDefault: 'true',
  },
  {
    key: 'documents.allowedConnectOrigins',
    variable: 'ALLOWED_CONNECT_ORIGINS',
    typedDefault: '',
    nonDefault: 'https://documents.example.com',
  },
  {
    key: 'overlay.allowedOrigins',
    variable: 'ALLOWED_IFRAME_ORIGINS',
    typedDefault: '',
    nonDefault: 'https://host.example.com',
  },
  {
    key: 'fileManager.availableTabs',
    variable: 'FILE_MANAGER_AVAILABLE_TABS',
    typedDefault: '',
    nonDefault: 'shared,my_files',
  },
  {
    key: 'features.liveChatInteraction',
    variable: 'LIVE_CHAT_INTERACTION_ENABLED',
    typedDefault: 'false',
    nonDefault: 'true',
  },
  {
    key: 'features.scheduledTasksEnabled',
    variable: 'SCHEDULED_TASKS_ENABLED',
    typedDefault: 'false',
    nonDefault: 'true',
  },
  {
    key: 'features.projectsEnabled',
    variable: 'PROJECTS_ENABLED',
    typedDefault: 'false',
    nonDefault: 'true',
  },
  {
    key: 'features.defaultDeploymentPinned',
    variable: 'DEFAULT_DEPLOYMENT_PINNED',
    typedDefault: 'false',
    nonDefault: 'true',
  },
  {
    key: 'features.visualizerSendMessages',
    variable: 'ALLOW_VISUALIZER_SEND_MESSAGES',
    typedDefault: 'false',
    nonDefault: 'true',
  },
  {
    key: 'features.usageLimitsControl',
    variable: 'USAGE_LIMITS_CONTROL_ENABLED',
    typedDefault: 'false',
    nonDefault: 'true',
  },
  {
    key: 'uiFeatures.enabledUiFeatures',
    variable: 'ENABLED_UI_FEATURES',
    typedDefault: '',
    nonDefault: 'likes,input-files',
  },
  {
    key: 'customVisualizers',
    variable: 'CUSTOM_VISUALIZERS',
    nonDefault:
      '[{"title":"Viz","contentType":"text/x-viz","url":"https://viz.example.com"}]',
  },
  {
    key: 'applicationVisualizers',
    variable: 'APPLICATION_VISUALIZERS',
    nonDefault: '{"app-1":{"title":"Viz","url":"https://viz.example.com"}}',
  },
  {
    key: 'publish.publicationFilterSources',
    variable: 'PUBLICATION_FILTER_SOURCES',
    typedDefault: '',
    nonDefault: 'title,department',
  },
  {
    key: 'content.additionalLocales',
    variable: 'ADDITIONAL_CONTENT_LOCALES',
    nonDefault: 'de-de,fr,de-DE',
  },
  {
    key: 'attachments.maxFileSizeBytes',
    variable: 'FILE_UPLOAD_MAX_BYTES',
    typedDefault: '536870912',
    nonDefault: '1048576',
  },
  {
    key: 'projects.contextFileMaxBytes',
    variable: 'PROJECT_CONTEXT_FILE_MAX_BYTES',
    typedDefault: '1048576',
    nonDefault: '2048',
  },
  {
    key: 'projects.contextTotalMaxBytes',
    variable: 'PROJECT_CONTEXT_TOTAL_MAX_BYTES',
    typedDefault: '10485760',
    nonDefault: '4194304',
  },
  {
    key: 'projects.contextAllowedExtensions',
    variable: 'PROJECT_CONTEXT_ALLOWED_EXTENSIONS',
    typedDefault: 'csv,pdf,xlsx',
    nonDefault: 'md,txt',
  },
  {
    key: 'usageLimits.warningThresholdPercent',
    variable: 'USAGE_LIMITS_WARNING_THRESHOLD_PERCENT',
    typedDefault: '75',
    nonDefault: '80',
  },
];

/** A named scenario: one raw environment, one key, one caller. */
export interface ScenarioCase {
  readonly name: string;
  readonly key: string;
  readonly env: RawEnvironment;
  readonly context?: AppConfigEvalContext;
}

export const ALLOWED_CALLER: AppConfigEvalContext = {
  appId: 'chat-ui',
  userId: 'allowed',
  roles: ['beta'],
};
export const RESTRICTED_CALLER: AppConfigEvalContext = {
  appId: 'chat-ui',
  userId: 'restricted',
  roles: ['staff'],
};

const CALLERS: ReadonlyArray<readonly [string, AppConfigEvalContext]> = [
  ['allowed', ALLOWED_CALLER],
  ['restricted', RESTRICTED_CALLER],
  ['anonymous', ANONYMOUS],
];

const ROLE_GATED: ReadonlyArray<
  readonly [key: string, enabledVar: string | null, rolesVar: string]
> = [
  ['features.asrEnabled', null, 'ASR_ENABLED_ROLES'],
  [
    'features.liveChatInteraction',
    'LIVE_CHAT_INTERACTION_ENABLED',
    'LIVE_CHAT_INTERACTION_ENABLED_ROLES',
  ],
  [
    'features.scheduledTasksEnabled',
    'SCHEDULED_TASKS_ENABLED',
    'SCHEDULED_TASKS_ENABLED_ROLES',
  ],
  ['features.projectsEnabled', 'PROJECTS_ENABLED', 'PROJECTS_ENABLED_ROLES'],
];

/**
 * The four role-gated features: enabled, not enabled and unset, each with no
 * role list, an empty one and `beta`, for an allowed, a restricted and an
 * anonymous caller. ASR is enabled through `ASR_MODEL`.
 */
export const ROLE_GATE_CASES: readonly ScenarioCase[] = ROLE_GATED.flatMap(
  ([key, enabledVar, rolesVar]) => {
    const enabledStates: ReadonlyArray<readonly [string, RawEnvironment]> =
      enabledVar === null
        ? [
            ['model set', { ASR_MODEL: 'whisper-1' }],
            ['model unset', {}],
          ]
        : [
            ['enabled', { [enabledVar]: 'true' }],
            ['disabled', { [enabledVar]: 'false' }],
            ['unset', {}],
          ];
    const roleStates: ReadonlyArray<readonly [string, RawEnvironment]> = [
      ['no roles', {}],
      ['empty roles', { [rolesVar]: '' }],
      ['roles beta', { [rolesVar]: 'beta' }],
    ];
    return enabledStates.flatMap(([enabledName, enabledEnv]) =>
      roleStates.flatMap(([rolesName, rolesEnv]) =>
        CALLERS.map(([callerName, context]) => ({
          name: `${key} ${enabledName}, ${rolesName}, ${callerName}`,
          key,
          env: { ...enabledEnv, ...rolesEnv },
          context,
        })),
      ),
    );
  },
);

/** The capability-derived features. */
export const DERIVED_CASES: readonly ScenarioCase[] = [
  ...(
    [
      ['absent', {}],
      ['set', { ASR_MODEL: 'whisper-1' }],
      ['empty', { ASR_MODEL: '' }],
    ] as const
  ).map(([name, env]) => ({
    name: `features.asrEnabled ASR_MODEL ${name}`,
    key: 'features.asrEnabled',
    env,
  })),
  ...(
    [
      ['nothing set', {}],
      ['opt-in only', { LLM_CONVERSATION_NAMING_ENABLED: 'true' }],
      [
        'model and key, no opt-in',
        { UTILITY_MODEL: 'gpt-4o-mini', DIAL_API_KEY: 'secret' },
      ],
      [
        'model, key and opt-in',
        {
          UTILITY_MODEL: 'gpt-4o-mini',
          DIAL_API_KEY: 'secret',
          LLM_CONVERSATION_NAMING_ENABLED: 'true',
        },
      ],
      [
        'model, key and opt-out',
        {
          UTILITY_MODEL: 'gpt-4o-mini',
          DIAL_API_KEY: 'secret',
          LLM_CONVERSATION_NAMING_ENABLED: 'false',
        },
      ],
      [
        'key and opt-in, no model',
        { DIAL_API_KEY: 'secret', LLM_CONVERSATION_NAMING_ENABLED: 'true' },
      ],
      [
        'model and opt-in, no key',
        {
          UTILITY_MODEL: 'gpt-4o-mini',
          LLM_CONVERSATION_NAMING_ENABLED: 'true',
        },
      ],
      [
        'empty model with key and opt-in',
        {
          UTILITY_MODEL: '',
          DIAL_API_KEY: 'secret',
          LLM_CONVERSATION_NAMING_ENABLED: 'true',
        },
      ],
    ] as const
  ).map(([name, env]) => ({
    name: `features.llmConversationNaming ${name}`,
    key: 'features.llmConversationNaming',
    env,
  })),
  ...(
    [
      ['absent', {}],
      ['set', { FOOTER_HTML_MESSAGE: 'Footer' }],
      ['empty', { FOOTER_HTML_MESSAGE: '' }],
    ] as const
  ).map(([name, env]) => ({
    name: `features.footer FOOTER_HTML_MESSAGE ${name}`,
    key: 'features.footer',
    env,
  })),
];

const parserCases = (
  key: string,
  variable: string,
  inputs: ReadonlyArray<readonly [string, string | undefined]>,
  extraEnv: RawEnvironment = {},
): ScenarioCase[] =>
  inputs.map(([name, value]) => ({
    name: `${key} ${name}`,
    key,
    env:
      value === undefined
        ? { ...extraEnv }
        : { ...extraEnv, [variable]: value },
  }));

/** Valid, malformed, empty and absent input for each special parser. */
export const PARSER_CASES: readonly ScenarioCase[] = [
  ...parserCases('announcement.items', 'ANNOUNCEMENTS', [
    ['absent', undefined],
    ['empty', ''],
    [
      'valid',
      '[{"title":"A","description":"<b>B</b>","link":{"label":"Read","href":"https://a.example.com"}}]',
    ],
    ['invalid JSON', '[{'],
    ['not an array', '{"title":"A"}'],
    [
      'mixed entries',
      '[{"title":" "},{"title":"Ok"},{"title":"Bad link","link":{"label":"x","href":"javascript:alert(1)"}},"text"]',
    ],
  ]),
  ...parserCases('customVariables', 'CUSTOM_CLIENT_VARIABLES', [
    ['absent', undefined],
    ['empty', ''],
    ['blank', '   '],
    ['valid', '{"a":1,"nested":{"b":[true,null]}}'],
    ['invalid JSON', '{invalid'],
    ['array', '[]'],
    ['null', 'null'],
  ]),
  ...parserCases('customVisualizers', 'CUSTOM_VISUALIZERS', [
    ['absent', undefined],
    ['empty', ''],
    [
      'valid',
      '[{"title":"Viz","contentType":"text/x-viz","url":"https://viz.example.com","width":300}]',
    ],
    ['invalid JSON', '[{'],
    ['not an array', '{"title":"Viz"}'],
    [
      'mixed entries',
      '[42,{"title":"","contentType":"text/x","url":"https://a.example.com"},{"title":"Viz","contentType":" , ","url":"https://b.example.com"},{"title":"Viz","contentType":"text/x","url":"https://c.example.com","development":true}]',
    ],
  ]),
  ...parserCases(
    'applicationVisualizers',
    'APPLICATION_VISUALIZERS',
    [
      ['absent', undefined],
      ['empty', ''],
      [
        'valid',
        '{"app-1":{"title":"Viz","url":"https://viz.example.com","borderless":true}}',
      ],
      ['invalid JSON', '{'],
      ['array', '[]'],
      [
        'mixed entries',
        '{"a":42,"b":{"title":"","url":"https://b.example.com"},"c":{"title":"Viz","url":"https://c.example.com","contentType":" , "},"d":{"title":"Viz","url":"https://other.example.org","expanded":true}}',
      ],
    ],
    { ALLOWED_IFRAME_ORIGINS: 'https://viz.example.com' },
  ),
  ...parserCases('fileManager.availableTabs', 'FILE_MANAGER_AVAILABLE_TABS', [
    ['absent', undefined],
    ['empty', ''],
    ['valid', 'organization,all'],
    ['partly unknown', 'shared,nope'],
    ['all unknown', 'nope,other'],
    ['separators only', ' , '],
  ]),
  ...parserCases(
    'publish.publicationFilterSources',
    'PUBLICATION_FILTER_SOURCES',
    [
      ['absent', undefined],
      ['empty', ''],
      ['valid', 'title, department'],
      ['separators only', ' , '],
    ],
  ),
  ...parserCases('content.additionalLocales', 'ADDITIONAL_CONTENT_LOCALES', [
    ['absent', undefined],
    ['empty', ''],
    ['valid', 'de-de,fr,de-DE'],
    ['malformed', 'de,not a locale'],
  ]),
  ...parserCases(
    'content.additionalLocales',
    'AVAILABLE_LOCALES',
    [
      ['legacy only', '["ar","en"]'],
      ['legacy empty', ''],
    ],
    {},
  ).map((entry) => ({ ...entry, name: `${entry.name} (AVAILABLE_LOCALES)` })),
  {
    name: 'content.additionalLocales both set',
    key: 'content.additionalLocales',
    env: { ADDITIONAL_CONTENT_LOCALES: 'fr', AVAILABLE_LOCALES: 'de' },
  },
  {
    name: 'content.additionalLocales new empty, legacy set',
    key: 'content.additionalLocales',
    env: { ADDITIONAL_CONTENT_LOCALES: '', AVAILABLE_LOCALES: 'de' },
  },
];

/**
 * Every variable a scenario above sets. Specs unset these in `process.env`,
 * because `ConfigService` falls back to the process environment and the
 * Vitest config pins `UTILITY_MODEL`.
 */
export const SCENARIO_VARIABLES: readonly string[] = [
  ...new Set(
    [
      ...ENV_KEY_CASES.map((entry) => entry.variable),
      ...[...ROLE_GATE_CASES, ...DERIVED_CASES, ...PARSER_CASES].flatMap(
        (entry) => Object.keys(entry.env),
      ),
    ].sort(),
  ),
];
