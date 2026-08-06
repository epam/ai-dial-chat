import { UseFormClearErrors, UseFormSetError } from 'react-hook-form';

import {
  fitApplicationNameToStorageLimits,
  getEditorSchemaType,
  getLocalizedEntityIdName,
  getMcpToolsetStr,
  getQuick2AppDocumentUrl,
  getQuickAppDocumentUrl,
  getQuickAppItemNameFromConfig,
  getStorageSafeUniqueApplicationName,
  getWebAPIToolsetStr,
  isDialAiEntityModel,
  migrateMCPToolsetIdName,
  parseLocalizedDescription,
  safeStringifyApplicationFeatures,
} from '@/src/utils/app/application';
import { getDefaultSchemaModel } from '@/src/utils/app/application-type-schema';
import { BucketService } from '@/src/utils/app/data/bucket-service';
import { DefaultsService } from '@/src/utils/app/data/defaults-service';
import { isApplicationId, isToolsetId } from '@/src/utils/app/id';
import {
  doesAgentSupportMcp,
  doesModelAllowTemperature,
} from '@/src/utils/app/models';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';
import { zodValidation } from '@/src/utils/zod-config-wrapper';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import {
  CustomApplicationModel,
  ExternalAppConfig,
  Toolsets,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { DialAIEntityFeatures, DialAIEntityModel } from '@/src/types/models';
import {
  AnyToolset,
  CodeInterpreterToolset,
  DialAppToolset,
  DialAppTransportType,
  DialDeploymentSimpleTool,
  DialPromptSkill,
  MCPToolset,
  QuickApp2Config,
  QuickAppConfig,
  UnknownToolset,
  isDialAppToolset,
  isDialDeploymentSimpleTool,
  isDialDeploymentToolset,
  isMcpToolset,
  isUnknownToolset,
} from '@/src/types/quick-apps';
import { Translation } from '@/src/types/translation';

import {
  ApplicationPropertiesLocalFields,
  CODEAPPS_REQUIRED_FILES,
  FEATURES_ENDPOINTS,
  FEATURES_ENDPOINTS_DEFAULT_VALUES,
  FEATURES_ENDPOINTS_NAMES,
} from '@/src/constants/applications';
import {
  DEFAULT_APPLICATION_NAME,
  DEFAULT_TEMPERATURE,
} from '@/src/constants/default-ui-settings';
import { formErrors } from '@/src/constants/form-errors';
import { ChatI18nKeys, CommonI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_VERSION } from '@/src/constants/publication';
import {
  DEFAULT_QUICK_APPS_MODEL,
  DialDeploymentToolsetToolTypes,
  ORCHESTRATOR_ATTACHMENT_STRATEGY_VALUE,
  REPRESENTATION_TOOLING_FEATURE_VALUE,
  TIMESTAMP_FEATURE_VALUE,
  ToolsetTypes,
  WEB_FETCH_FEATURE_VALUE,
} from '@/src/constants/quick-apps';
import {
  AttachmentTypesSchema,
  CompletionUrlSchema,
  DynamicFieldSchema,
  MarketplaceEntityBaseSchema,
  MaxInputAttachmentsSchema,
} from '@/src/constants/validation-helpers';

import { ShareEntity } from '@epam/ai-dial-shared';
import omit from 'lodash-es/omit';
import sortBy from 'lodash-es/sortBy';
import uniq from 'lodash-es/uniq';
import { nanoid } from 'nanoid';

export enum AppsEditorSchemaTypes {
  CustomApp = 'Custom app',
  ExternalApp = 'External app',
  QuickApp = 'Quick app',
  QuickApp2 = 'Quick app2',
  CodeApp = 'Code App',
  SchemaDriven = 'Schema Driven',
}

export const MANDATORY_FIELD_PLACEHOLDER = 'MANDATORY_FIELD_PLACEHOLDER';

// Definition
export type BaseAppForm = zodValidation.infer<
  typeof MarketplaceEntityBaseSchema
>;

const CustomAppSchema = zodValidation.object({
  type: zodValidation.literal(AppsEditorSchemaTypes.CustomApp),
  inputAttachmentTypes: AttachmentTypesSchema,
  completionUrl: CompletionUrlSchema.nonempty(formErrors.required).or(
    zodValidation.literal(MANDATORY_FIELD_PLACEHOLDER),
  ),
  features: zodValidation
    .string()
    .nullable()
    .superRefine((data, ctx) => {
      if (!data?.trim()) return;
      try {
        const object = JSON.parse(data);
        if (typeof object === 'object' && !!object && !Array.isArray(object)) {
          for (const [key, value] of Object.entries(object)) {
            if (!key.trim()) {
              ctx.addIssue({
                code: 'custom',
                path: ['features'],
                message: 'Keys should not be empty',
              });
              return;
            }
            const valueType = typeof value;
            if (
              !(['boolean', 'number'].includes(valueType) || value === null)
            ) {
              if (typeof value === 'string' && !value.trim()) {
                ctx.addIssue({
                  code: 'custom',
                  path: ['features'],
                  message: 'String values should not be empty',
                });
                return;
              }
              if (!['boolean', 'number', 'string'].includes(valueType)) {
                ctx.addIssue({
                  code: 'custom',
                  path: ['features'],
                  message: 'Values should be a string, number, boolean or null',
                });
                return;
              }
            }
          }
        } else {
          ctx.addIssue({
            code: 'custom',
            path: ['features'],
            message: 'Data is not a valid JSON object',
          });
          return;
        }
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['features'],
          message: 'Invalid JSON string',
        });
      }
    }),
  maxInputAttachments: MaxInputAttachmentsSchema.optional(),
});
export type CustomAppForm = zodValidation.infer<typeof CustomAppSchema>;

const ExternalAppSchema = zodValidation.object({
  type: zodValidation.literal(AppsEditorSchemaTypes.ExternalApp),
  externalUrl: CompletionUrlSchema.nonempty(formErrors.required).or(
    zodValidation.literal(MANDATORY_FIELD_PLACEHOLDER),
  ),
});
export type ExternalAppForm = zodValidation.infer<typeof ExternalAppSchema>;

const SchemaDrivenAppSchema = zodValidation
  .object({
    type: zodValidation.literal(AppsEditorSchemaTypes.SchemaDriven),
    required: zodValidation.array(zodValidation.string()),
    properties: zodValidation.record(
      zodValidation.string(),
      zodValidation.unknown(),
    ),
  })
  .superRefine((data, ctx) => {
    if (!data.required.length || data.properties[MANDATORY_FIELD_PLACEHOLDER])
      return;

    data.required.forEach((field) => {
      if (!data.properties[field]) {
        ctx.addIssue({
          code: 'custom',
          path: ['properties'],
          message: 'Field is required',
        });
      }
    });
  });
export type SchemaDrivenAppForm = zodValidation.infer<
  typeof SchemaDrivenAppSchema
>;

const QuickAppSchema = zodValidation.object({
  type: zodValidation.literal(AppsEditorSchemaTypes.QuickApp),
  instructions: zodValidation.string(),
  temperature: zodValidation.number(),
  [Toolsets.WebApiToolset]: zodValidation
    .string()
    .nonempty('Toolset config is required')
    .refine((v) => {
      try {
        JSON.parse(v);
        return true;
      } catch {
        return false;
      }
    }, 'Config is not a valid JSON object'),
  [Toolsets.McpToolset]: zodValidation.string().refine((v) => {
    try {
      JSON.parse(v);
      return true;
    } catch {
      return false;
    }
  }, 'Config is not a valid JSON object'),
  documentRelativeUrl: zodValidation.array(zodValidation.string()),
  model: zodValidation.string(),
});
export type QuickAppForm = zodValidation.infer<typeof QuickAppSchema>;

export enum AgentOrToolsetSchemaKeys {
  id = '[schema]:id',
  tool = '[schema]:tool',
  isDialDeploymentTool = '[schema]:isDialDeploymentTool',
  name = '[schema]:name',
}

const AgentOrToolsetSchema = zodValidation.object({
  [AgentOrToolsetSchemaKeys.id]: zodValidation.string(),
  [AgentOrToolsetSchemaKeys.tool]: zodValidation
    .record(zodValidation.string(), zodValidation.any())
    .optional(),
  [AgentOrToolsetSchemaKeys.isDialDeploymentTool]: zodValidation
    .boolean()
    .optional(), // tool_sets can have both agents from marketplace and custom tools listed in DialDeploymentToolset
});

type AgentOrToolsetFormType = zodValidation.infer<typeof AgentOrToolsetSchema>;

export const QuickApp2Schema = zodValidation
  .object({
    type: zodValidation.literal(AppsEditorSchemaTypes.QuickApp2),
    instructions: zodValidation.string(),
    temperature: zodValidation.number(),
    documentRelativeUrl: zodValidation.array(zodValidation.string()),
    model: zodValidation.string(),
    agentsAndToolsets: zodValidation.array(AgentOrToolsetSchema),
    codeInterpreter: zodValidation.boolean(),
    inputAttachmentTypes: AttachmentTypesSchema,
    maxInputAttachments: MaxInputAttachmentsSchema.optional(),
    isJsonView: zodValidation.boolean(),
    agentsAndToolsetsJson: zodValidation.string(),
    introText: zodValidation.string().optional(),
    chatMessageInputDisabled: zodValidation.boolean(),
    autoSubmit: zodValidation.boolean(),
    starters: zodValidation.array(
      zodValidation.object({
        id: zodValidation.string(),
        title: zodValidation.string(),
        text: zodValidation.string(),
      }),
    ),
    toolSupportingModelIds: zodValidation
      .array(zodValidation.string())
      .optional(),
    availableModelIds: zodValidation.array(zodValidation.string()).optional(),
    agentSkills: zodValidation.array(zodValidation.string()),
    timestamp: zodValidation.boolean(),
    fileTools: zodValidation.boolean(),
    processLargeFiles: zodValidation.boolean(),
    addAttachment: zodValidation.boolean(),
    webFetch: zodValidation.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.isJsonView) {
      try {
        const parsed: unknown[] = JSON.parse(data.agentsAndToolsetsJson);

        if (!Array.isArray(parsed)) {
          ctx.addIssue({
            code: 'custom',
            path: ['agentsAndToolsetsJson'],
            message: translate(CommonI18nKeys.ShouldBeAnArray),
          });
        }
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['agentsAndToolsetsJson'],
          message: translate(CommonI18nKeys.ShouldBeAValidJSON),
        });
      }
    }
    const modelExists =
      !data.availableModelIds || data.availableModelIds.includes(data.model);

    if (!modelExists) {
      ctx.addIssue({
        code: 'custom',
        path: ['model'],
        message: translate(ChatI18nKeys.IncorrectSelectedModel, {
          ns: Translation.Chat,
        }),
      });
      return;
    }

    if (data.toolSupportingModelIds?.includes(data.model) === false) {
      ctx.addIssue({
        code: 'custom',
        path: ['model'],
        message: translate(CommonI18nKeys.SelectedModelDoesNotSupportTools),
      });
    }
  });
export type QuickApp2Form = zodValidation.infer<typeof QuickApp2Schema>;

const CodeAppSchema = zodValidation
  .object({
    type: zodValidation.literal(AppsEditorSchemaTypes.CodeApp),
    inputAttachmentTypes: AttachmentTypesSchema,
    filesLoaded: zodValidation.boolean(),
    sources: zodValidation
      .string()
      .nonempty('Source folder is required')
      .or(zodValidation.literal(MANDATORY_FIELD_PLACEHOLDER)),
    sourceFiles: zodValidation.array(zodValidation.string()),
    runtime: zodValidation.string(),
    endpoints: zodValidation
      .array(
        DynamicFieldSchema.omit({ value: true }).extend({
          value: zodValidation
            .string()
            .trim()
            .nonempty('Endpoint is required')
            .startsWith('/', "Endpoint should start with '/'")
            .regex(
              /^[a-zA-Z0-9/_-]+$/,
              "Endpoint should contain only letters, numbers, '-', '_' and '/'",
            )
            .max(255, 'Endpoint should be no longer than 255 characters'),
        }),
      )
      .refine((endpoints) => {
        const keys = endpoints.map(({ label }) => label);
        return endpoints.length === uniq(keys).length;
      }, 'Key must be unique'),
    maxInputAttachments: MaxInputAttachmentsSchema.optional(),
    env: zodValidation.array(DynamicFieldSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.sources === MANDATORY_FIELD_PLACEHOLDER ||
      !data.sources ||
      !data.filesLoaded
    )
      return;

    if (!data.sourceFiles.includes(CODEAPPS_REQUIRED_FILES.APP)) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceFiles'],
        message: `This folder does not contain the required "${CODEAPPS_REQUIRED_FILES.APP}" file`,
      });
    }
    if (!data.sourceFiles.includes(CODEAPPS_REQUIRED_FILES.REQUIREMENTS)) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceFiles'],
        message: `This folder does not contain the required "${CODEAPPS_REQUIRED_FILES.REQUIREMENTS}" file`,
      });
    }
  });
export type CodeAppForm = zodValidation.infer<typeof CodeAppSchema>;

export type AppsEditorFormType = (
  | CustomAppForm
  | ExternalAppForm
  | QuickAppForm
  | QuickApp2Form
  | CodeAppForm
  | SchemaDrivenAppForm
) &
  BaseAppForm;

// Implementation
const getBaseFormData = ({
  app,
  models,
  locale,
}: {
  app?: CustomApplicationModel;
  models?: ShareEntity[];
  locale: string;
}): BaseAppForm => ({
  name:
    getLocalizedEntityIdName(app?.name) ||
    (getStorageSafeUniqueApplicationName({
      application: {
        name: '',
        version: app?.version ?? DEFAULT_VERSION,
        folderId: app?.folderId,
        id: app?.id,
      },
      defaultName: DEFAULT_APPLICATION_NAME,
      existingNames: (models ?? []).map((m) => m.name),
    }) ??
      DEFAULT_APPLICATION_NAME),
  version: app ? (app.version ?? '') : DEFAULT_VERSION,
  iconUrl: app?.iconUrl ?? '',
  description: parseLocalizedDescription(locale, app?.description),
  topics: app?.topics ?? [],
  locals: [],
});

const getCustomAppFormData = (app?: CustomApplicationModel): CustomAppForm => ({
  type: AppsEditorSchemaTypes.CustomApp,
  inputAttachmentTypes: app?.inputAttachmentTypes ?? [],
  maxInputAttachments: app?.maxInputAttachments ?? undefined,
  completionUrl:
    app && !app.applicationTypeSchemaId
      ? (app.completionUrl ?? '') // for custom apps
      : app?.completionUrl || MANDATORY_FIELD_PLACEHOLDER, // fallback for schema-applications
  features: safeStringifyApplicationFeatures(app?.features),
});

const getQuickAppFormData = (app?: CustomApplicationModel): QuickAppForm => {
  const appProperties = app?.applicationProperties as QuickAppConfig;

  return {
    type: AppsEditorSchemaTypes.QuickApp,
    documentRelativeUrl: getQuickAppDocumentUrl(app) ?? [],
    model:
      typeof appProperties?.model === 'string'
        ? appProperties?.model
        : DefaultsService.get('quickAppsModel', DEFAULT_QUICK_APPS_MODEL),
    instructions:
      typeof appProperties?.instructions === 'string'
        ? appProperties.instructions
        : '',
    temperature:
      typeof appProperties?.temperature === 'number'
        ? appProperties.temperature
        : DEFAULT_TEMPERATURE,
    [Toolsets.WebApiToolset]:
      getWebAPIToolsetStr({
        web_api_toolset: appProperties?.web_api_toolset ?? [],
      } as QuickAppConfig) ?? '',
    [Toolsets.McpToolset]:
      getMcpToolsetStr({
        mcp_toolset: appProperties?.mcp_toolset ?? [],
      } as QuickAppConfig) ?? '',
  };
};

export const getAgentsAndToolsetsFormValue = (
  tools?: AnyToolset[],
): AgentOrToolsetFormType[] => {
  const deploymentTools =
    tools
      ?.filter(isDialDeploymentToolset)
      ?.flatMap((toolset) => toolset.tools) ?? [];
  // TODO: remove migrateMCPToolsetIdName after migrating all old toolsets with 'dial_id' to 'deployment_id'
  const mcpToolsets = (tools?.filter(isMcpToolset) ?? []).map(
    migrateMCPToolsetIdName,
  );
  const dialAppToolsets = tools?.filter(isDialAppToolset) ?? [];
  const unknownToolsets = tools?.filter(isUnknownToolset) ?? [];

  const markedDeploymentTools = deploymentTools?.map((item) => ({
    ...item,
    [AgentOrToolsetSchemaKeys.name]: getQuickAppItemNameFromConfig(item),
    [AgentOrToolsetSchemaKeys.isDialDeploymentTool]: true,
  }));
  const allItems = [...mcpToolsets, ...unknownToolsets, ...dialAppToolsets].map(
    (item) => ({
      ...item,
      [AgentOrToolsetSchemaKeys.name]: getQuickAppItemNameFromConfig(
        item as MCPToolset,
      ),
    }),
  );

  const sortedItems = sortBy(
    [...markedDeploymentTools, ...allItems],
    [(item) => item[AgentOrToolsetSchemaKeys.name].toLowerCase()],
  );

  return sortedItems.map((item) => {
    const id =
      isUnknownToolset(item) && !isDialDeploymentSimpleTool(item)
        ? undefined
        : item.deployment_id;
    return {
      [AgentOrToolsetSchemaKeys.id]: id
        ? ApiUtils.decodeApiUrl(id)
        : (item[AgentOrToolsetSchemaKeys.name] ?? 'unknown'),
      [AgentOrToolsetSchemaKeys.tool]: item,
      [AgentOrToolsetSchemaKeys.isDialDeploymentTool]:
        AgentOrToolsetSchemaKeys.isDialDeploymentTool in item
          ? item[AgentOrToolsetSchemaKeys.isDialDeploymentTool]
          : false,
    };
  });
};

const getQuickApp2FormData = (
  app?: CustomApplicationModel,
  toolSupportingModelIds?: string[],
  availableModelIds?: string[],
  schema?: ApiDetailedApplicationTypeSchema,
): QuickApp2Form => {
  const appProperties = app?.applicationProperties as QuickApp2Config;
  // show selected model for existing Quick Apps
  let model = appProperties?.orchestrator?.deployment?.deployment_id;
  if (!model) {
    const defaultModelId =
      getDefaultSchemaModel(schema) ??
      DefaultsService.get('quickAppsModel', DEFAULT_QUICK_APPS_MODEL);
    // check if default model for quick app is configured correctly
    model = toolSupportingModelIds?.includes(defaultModelId)
      ? defaultModelId // use default quick app model
      : (toolSupportingModelIds?.[0] ?? ''); // use first from list
  }

  const timestamp =
    'timestamp' in (appProperties?.features ?? {})
      ? !!appProperties?.features?.timestamp
      : true;
  const fileTools =
    'dial_files' in (appProperties?.features ?? {})
      ? !!appProperties?.features?.dial_files
      : false;
  const addAttachment =
    'representation_tooling' in (appProperties?.features ?? {})
      ? !!appProperties?.features?.representation_tooling?.add_attachment
      : false;
  const webFetch =
    'web_fetch' in (appProperties?.features ?? {})
      ? !!appProperties?.features?.web_fetch?.enabled
      : false;
  const processLargeFiles =
    'attachment_strategy' in (appProperties?.orchestrator ?? {})
      ? !!appProperties?.orchestrator?.attachment_strategy
      : false;

  return {
    type: AppsEditorSchemaTypes.QuickApp2,
    documentRelativeUrl: getQuick2AppDocumentUrl(app) ?? [],
    model,
    instructions: appProperties?.orchestrator?.system_prompt?.content ?? '',
    temperature:
      appProperties?.orchestrator?.deployment?.parameters?.temperature ??
      DEFAULT_TEMPERATURE,
    agentsAndToolsets: getAgentsAndToolsetsFormValue(appProperties?.tool_sets),
    codeInterpreter:
      appProperties?.tool_sets?.some(
        (toolset) => toolset.type === ToolsetTypes.CodeInterpreter,
      ) ?? false,
    inputAttachmentTypes: app?.inputAttachmentTypes ?? [],
    maxInputAttachments: app?.maxInputAttachments ?? undefined,
    agentsAndToolsetsJson: JSON.stringify(
      appProperties?.tool_sets ?? [],
      null,
      2,
    ),
    introText: appProperties?.conversation_starters?.intro_text,
    chatMessageInputDisabled:
      appProperties?.conversation_starters?.chat_message_input_disabled ??
      false,
    autoSubmit: appProperties?.conversation_starters?.auto_submit ?? true,
    starters: [
      ...(appProperties?.conversation_starters?.starters ?? []).map(
        (starter) => ({ ...starter, id: nanoid() }),
      ),
      { id: nanoid(), title: '', text: '' },
    ],
    isJsonView: false,
    toolSupportingModelIds,
    availableModelIds,
    agentSkills: (appProperties?.skills ?? [])
      .filter((s): s is DialPromptSkill => s.type === 'dial-prompt')
      .map((s) => ApiUtils.decodeApiUrl(s.url)),
    timestamp,
    fileTools,
    processLargeFiles,
    addAttachment,
    webFetch,
  };
};

const getFormSourceFolder = (sourceFolder?: string) => {
  const bucket = BucketService.getBucket();

  return sourceFolder && sourceFolder !== `files/${bucket}`
    ? ApiUtils.decodeApiUrl(sourceFolder)
    : MANDATORY_FIELD_PLACEHOLDER;
};

const getCodeAppFormData = ({
  app,
  runtime,
}: {
  app?: CustomApplicationModel;
  runtime?: string;
}): CodeAppForm => ({
  type: AppsEditorSchemaTypes.CodeApp,
  inputAttachmentTypes: app?.inputAttachmentTypes ?? [],
  maxInputAttachments: app?.maxInputAttachments ?? undefined,
  filesLoaded: false,
  sources: getFormSourceFolder(app?.function?.sourceFolder),
  runtime: app?.function?.runtime ?? runtime ?? 'python3.11',
  sourceFiles: [],
  endpoints: app?.function?.mapping
    ? Object.entries(app.function.mapping).map(([key, value]) => ({
        label: key,
        visibleName: FEATURES_ENDPOINTS_NAMES[key],
        value,
        editableKey:
          !FEATURES_ENDPOINTS[key as keyof typeof FEATURES_ENDPOINTS],
        static: key === FEATURES_ENDPOINTS.chat_completion,
        id: nanoid(),
      }))
    : [
        {
          label: FEATURES_ENDPOINTS.chat_completion,
          visibleName:
            FEATURES_ENDPOINTS_NAMES[FEATURES_ENDPOINTS.chat_completion],
          value:
            FEATURES_ENDPOINTS_DEFAULT_VALUES[
              FEATURES_ENDPOINTS.chat_completion
            ] || '',
          editableKey: false,
          static: true,
          id: nanoid(),
        },
      ],
  env: app?.function?.env
    ? Object.entries(app.function.env).map(([label, value]) => ({
        label,
        value,
        editableKey: true,
        id: nanoid(),
      }))
    : [],
});

const getExternalAppFormData = (
  app?: CustomApplicationModel,
): ExternalAppForm => ({
  type: AppsEditorSchemaTypes.ExternalApp,
  externalUrl: app
    ? ((app?.applicationProperties as ExternalAppConfig)?.external_url ?? '')
    : MANDATORY_FIELD_PLACEHOLDER,
});

const getSchemaDrivenFormData = (
  app?: CustomApplicationModel,
  schema?: ApiDetailedApplicationTypeSchema,
): SchemaDrivenAppForm => ({
  type: AppsEditorSchemaTypes.SchemaDriven,
  properties: {
    ...omit(
      app?.applicationProperties ?? {
        [MANDATORY_FIELD_PLACEHOLDER]: true,
      },
      ['document_relative_url'],
    ),
  },
  required: schema?.required ?? [],
});

const getSettingsFormData = ({
  app,
  type,
  runtime,
  toolSupportingModelIds,
  availableModelIds,
  schema,
}: {
  app?: CustomApplicationModel;
  type: AppsEditorSchemaTypes;
  runtime?: string;
  toolSupportingModelIds?: string[];
  availableModelIds?: string[];
  schema?: ApiDetailedApplicationTypeSchema;
}) => {
  switch (type) {
    case AppsEditorSchemaTypes.ExternalApp:
      return getExternalAppFormData(app);
    case AppsEditorSchemaTypes.CodeApp:
      return getCodeAppFormData({ app, runtime });
    case AppsEditorSchemaTypes.QuickApp:
      return getQuickAppFormData(app);
    case AppsEditorSchemaTypes.QuickApp2:
      return getQuickApp2FormData(
        app,
        toolSupportingModelIds,
        availableModelIds,
        schema,
      );
    case AppsEditorSchemaTypes.SchemaDriven:
      return getSchemaDrivenFormData(app, schema);
    case AppsEditorSchemaTypes.CustomApp:
    default:
      return getCustomAppFormData(app);
  }
};

export const getDefaultFormData = ({
  app,
  models,
  runtime,
  type,
  toolSupportingModelIds,
  schema,
  locale,
}: {
  type: string;
  app?: CustomApplicationModel;
  models?: ShareEntity[];
  runtime?: string;
  toolSupportingModelIds?: string[];
  schema?: ApiDetailedApplicationTypeSchema;
  locale: string;
}): AppsEditorFormType => ({
  ...getBaseFormData({ app, models, locale }),
  ...getSettingsFormData({
    app,
    runtime,
    type: getEditorSchemaType(type, schema),
    toolSupportingModelIds,
    availableModelIds: models?.map((model) => model.id),
    schema,
  }),
});

export const getValidationSchema = (
  schemaType: string,
  schema?: ApiDetailedApplicationTypeSchema,
) => {
  const type = getEditorSchemaType(schemaType, schema);
  switch (type) {
    case AppsEditorSchemaTypes.ExternalApp:
      return ExternalAppSchema.and(MarketplaceEntityBaseSchema);
    case AppsEditorSchemaTypes.CodeApp:
      return CodeAppSchema.and(MarketplaceEntityBaseSchema);
    case AppsEditorSchemaTypes.QuickApp:
      return QuickAppSchema.and(MarketplaceEntityBaseSchema);
    case AppsEditorSchemaTypes.QuickApp2:
      return QuickApp2Schema.and(MarketplaceEntityBaseSchema);
    case AppsEditorSchemaTypes.SchemaDriven:
      return SchemaDrivenAppSchema.and(MarketplaceEntityBaseSchema);
    case AppsEditorSchemaTypes.CustomApp:
    default:
      return CustomAppSchema.and(MarketplaceEntityBaseSchema);
  }
};

export const getAttachmentTypeErrorHandlers = (
  setError: UseFormSetError<{ inputAttachmentTypes: string[] }>,
  clearErrors: UseFormClearErrors<{ inputAttachmentTypes: string[] }>,
) => {
  const validationRegExp = new RegExp(
    '^([a-zA-Z0-9!*\\-.+]+|\\*)\\/([a-zA-Z0-9!*\\-.+]+|\\*)$',
  );
  const handleError = () => {
    setError('inputAttachmentTypes', {
      type: 'manual',
      message: 'Please match the MIME format',
    });
  };
  const handleClearError = () => {
    clearErrors('inputAttachmentTypes');
  };

  return { validationRegExp, handleError, handleClearError };
};

const getActualSourceFolder = (formSources?: string) => {
  const bucket = BucketService.getBucket();

  return !formSources || formSources === MANDATORY_FIELD_PLACEHOLDER
    ? `files/${bucket}`
    : formSources;
};

export const getAgentOrToolsetItem = (id: string): AnyToolset => {
  const isDeploymentToolset = isApplicationId(id);

  return {
    type: isDeploymentToolset
      ? DialDeploymentToolsetToolTypes.DialDeploymentSimple
      : ToolsetTypes.DialMcp,
    deployment_id: ApiUtils.encodeApiUrl(id),
  };
};

export const getQuickApp2Toolsets = ({
  allEntitiesMap,
  data,
}: {
  allEntitiesMap: Record<string, MarketplaceEntity>;
  data: QuickApp2Form;
  currentTools?: AnyToolset[];
}): AnyToolset[] => {
  const {
    dialDeploymentsToolsets,
    dialMCPToolsets,
    otherToolsets,
    dialAppToolsets,
  } = data.agentsAndToolsets.reduce<{
    dialDeploymentsToolsets: DialDeploymentSimpleTool[];
    dialMCPToolsets: MCPToolset[];
    dialAppToolsets: DialAppToolset[];
    otherToolsets: UnknownToolset[];
  }>(
    (acc, agentAndToolset) => {
      const entity =
        allEntitiesMap[agentAndToolset[AgentOrToolsetSchemaKeys.id]];
      const toolData = omit(
        agentAndToolset[AgentOrToolsetSchemaKeys.tool] ?? {},
        Object.values(AgentOrToolsetSchemaKeys),
      );
      if (!entity) {
        if (isApplicationId(agentAndToolset[AgentOrToolsetSchemaKeys.id])) {
          acc.dialAppToolsets.push({
            ...toolData,
            name: getQuickAppItemNameFromConfig(toolData as DialAppToolset),
            type: ToolsetTypes.DialApp,
            deployment_id: ApiUtils.encodeApiUrl(
              agentAndToolset[AgentOrToolsetSchemaKeys.id],
            ),
          });
        } else if (isToolsetId(agentAndToolset[AgentOrToolsetSchemaKeys.id])) {
          acc.dialMCPToolsets.push({
            ...toolData,
            deployment_id: ApiUtils.encodeApiUrl(
              agentAndToolset[AgentOrToolsetSchemaKeys.id],
            ),
            type: ToolsetTypes.DialMcp,
          });
        } else if (
          agentAndToolset[AgentOrToolsetSchemaKeys.tool] &&
          agentAndToolset[AgentOrToolsetSchemaKeys.isDialDeploymentTool]
        ) {
          acc.dialDeploymentsToolsets.push(
            toolData as DialDeploymentSimpleTool,
          );
        } else if (agentAndToolset[AgentOrToolsetSchemaKeys.tool]) {
          acc.otherToolsets.push(toolData);
        }
        return acc;
      }

      if (isDialAiEntityModel(entity) && entity.type === EntityType.Model) {
        acc.dialDeploymentsToolsets.push({
          ...toolData,
          type: DialDeploymentToolsetToolTypes.DialDeploymentSimple,
          deployment_id: ApiUtils.encodeApiUrl(entity.id),
        });
      } else if (
        isDialAiEntityModel(entity) &&
        entity.type === EntityType.Application
      ) {
        acc.dialAppToolsets.push({
          ...toolData,
          name: getLocalizedEntityIdName(entity.name),
          type: ToolsetTypes.DialApp,
          deployment_id: ApiUtils.encodeApiUrl(entity.id),
          ...(doesAgentSupportMcp(entity) && {
            transport:
              (toolData as DialAppToolset).transport ??
              DialAppTransportType.MCP,
          }),
        });
      } else {
        acc.dialMCPToolsets.push({
          ...toolData,
          deployment_id: ApiUtils.encodeApiUrl(entity.id),
          type: ToolsetTypes.DialMcp,
        });
      }

      return acc;
    },
    {
      dialDeploymentsToolsets: [],
      dialMCPToolsets: [],
      dialAppToolsets: [],
      otherToolsets: [],
    },
  );

  return [
    ...dialMCPToolsets,
    ...dialAppToolsets,
    {
      name: 'dial-deployment-tool-set',
      type: ToolsetTypes.DialDeployment,
      tools: [...dialDeploymentsToolsets],
    },
    ...otherToolsets,
    ...(data.codeInterpreter
      ? [
          {
            template_name: 'py_interpreter',
            type: ToolsetTypes.CodeInterpreter,
          } as CodeInterpreterToolset,
        ]
      : []),
  ];
};

export const getApplicationPayload = ({
  data,
  currentApp,
  allEntitiesMap,
  keepCurrentToolsets,
}: {
  data: AppsEditorFormType;
  allEntitiesMap: Record<string, MarketplaceEntity>;
  currentApp?: CustomApplicationModel;
  keepCurrentToolsets?: boolean;
}): CustomApplicationModel => {
  const generalData = fitApplicationNameToStorageLimits({
    id: '',
    reference: '',
    folderId: '',
    ...(currentApp && currentApp),
    type: EntityType.Application,
    name: data.name,
    iconUrl: data.iconUrl,
    description: data.description,
    version: data.version,
    topics: data.topics,
    isDefault: false,
  });

  switch (data.type) {
    case AppsEditorSchemaTypes.CodeApp:
      return {
        ...generalData,
        applicationProperties: undefined,
        completionUrl: '',
        inputAttachmentTypes: data.inputAttachmentTypes,
        maxInputAttachments: data.maxInputAttachments
          ? Number(data.maxInputAttachments)
          : undefined,
        function: {
          sourceFolder: getActualSourceFolder(data.sources),
          mapping: data.endpoints.reduce(
            (acc, option) => ({
              ...acc,
              [option.label]: option.value.trim(),
            }),
            {},
          ),
          env: data.env?.length
            ? data.env.reduce(
                (acc, option) => ({
                  ...acc,
                  [option.label]: option.value,
                }),
                {},
              )
            : undefined,
          runtime: data.runtime,
        },
      };
    case AppsEditorSchemaTypes.ExternalApp:
      return {
        ...generalData,
        applicationProperties: {
          external_url: data.externalUrl ?? MANDATORY_FIELD_PLACEHOLDER,
          [ApplicationPropertiesLocalFields.isExternalApp]: true,
        },
      };
    case AppsEditorSchemaTypes.QuickApp:
      return {
        ...generalData,
        applicationProperties: {
          instructions: data.instructions,
          temperature: data.temperature,
          web_api_toolset: JSON.parse(data[Toolsets.WebApiToolset]),
          ...(data[Toolsets.McpToolset] && {
            mcp_toolset: JSON.parse(data[Toolsets.McpToolset]),
          }),
          model: allEntitiesMap[data.model]?.id ?? data.model,
          document_relative_url: data.documentRelativeUrl,
        },
      };

    case AppsEditorSchemaTypes.QuickApp2: {
      const model = allEntitiesMap[data.model] as DialAIEntityModel | undefined;
      const temperatureToUse = data.temperature;
      const shouldSendTemperature = model && doesModelAllowTemperature(model);

      const starters = data.starters
        .filter((starter) => starter.text.trim() && starter.title.trim())
        .map(({ title, text }) => ({ title, text }));

      return {
        ...generalData,
        inputAttachmentTypes: data.inputAttachmentTypes,
        maxInputAttachments: data.maxInputAttachments
          ? Number(data.maxInputAttachments)
          : undefined,
        features: {
          assistant_attachments_in_request_supported: true,
        } as unknown as DialAIEntityFeatures,
        applicationProperties: {
          orchestrator: {
            deployment: {
              deployment_id: model?.id ?? data.model,
              ...(shouldSendTemperature && {
                parameters: { temperature: temperatureToUse },
              }),
            },
            system_prompt: {
              type: 'custom',
              variables: {},
              content: data.instructions,
            },
            ...(!!model?.inputAttachmentTypes?.length && {
              attachment_strategy: data.processLargeFiles
                ? ORCHESTRATOR_ATTACHMENT_STRATEGY_VALUE
                : null,
            }),
          },
          contexts:
            data.documentRelativeUrl?.map((url) => ({
              url,
              type: 'file',
            })) ?? [],
          tool_sets:
            data.isJsonView && !keepCurrentToolsets
              ? (JSON.parse(data.agentsAndToolsetsJson) as AnyToolset[])
              : getQuickApp2Toolsets({ data, allEntitiesMap }),
          ...(data.agentSkills.length > 0 && {
            skills: data.agentSkills.map(
              (promptId): DialPromptSkill => ({
                type: 'dial-prompt',
                url: ApiUtils.encodeApiUrl(promptId),
              }),
            ),
          }),
          features: {
            timestamp: data.timestamp ? TIMESTAMP_FEATURE_VALUE : null,
            dial_files: data.fileTools ? {} : null,
            representation_tooling: data.addAttachment
              ? REPRESENTATION_TOOLING_FEATURE_VALUE
              : null,
            web_fetch: data.webFetch ? WEB_FETCH_FEATURE_VALUE : null,
          },
          ...(starters.length
            ? {
                conversation_starters: {
                  intro_text: data.introText,
                  chat_message_input_disabled: data.chatMessageInputDisabled,
                  auto_submit: data.autoSubmit,
                  starters,
                },
              }
            : {}),
        },
      };
    }
    case AppsEditorSchemaTypes.SchemaDriven:
      return {
        ...generalData,
        applicationProperties: {
          ...omit(data.properties, [MANDATORY_FIELD_PLACEHOLDER]),
          [ApplicationPropertiesLocalFields.isSchemaDrivenApp]: true,
        },
      };
    case AppsEditorSchemaTypes.CustomApp:
    default:
      return {
        ...generalData,
        completionUrl:
          data.completionUrl === MANDATORY_FIELD_PLACEHOLDER
            ? ''
            : data.completionUrl,
        inputAttachmentTypes: data.inputAttachmentTypes,
        maxInputAttachments: data.maxInputAttachments
          ? Number(data.maxInputAttachments)
          : undefined,
        features: data.features ? JSON.parse(data.features) : null,
      };
  }
};
