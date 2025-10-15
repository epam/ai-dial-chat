import { UseFormClearErrors, UseFormSetError } from 'react-hook-form';

import {
  getMcpToolsetStr,
  getQuick2AppDocumentUrl,
  getQuickAppDocumentUrl,
  getWebAPIToolsetStr,
  isDialAiEntityModel,
  safeStringifyApplicationFeatures,
} from '@/src/utils/app/application';
import { BucketService } from '@/src/utils/app/data/bucket-service';
import { DefaultsService } from '@/src/utils/app/data/defaults-service';
import { getNextDefaultName } from '@/src/utils/app/folders';
import { ApiUtils } from '@/src/utils/server/api';

import {
  ApplicationType,
  CustomApplicationModel,
  ExternalAppConfig,
  Toolsets,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import {
  AnyToolset,
  CodeInterpreterToolset,
  DialDeploymentSimpleTool,
  MCPToolset,
  QuickApp2Config,
  QuickAppConfig,
  isDialDeploymentToolset,
  isMcpToolset,
} from '@/src/types/quick-apps';

import {
  CODEAPPS_REQUIRED_FILES,
  FEATURES_ENDPOINTS,
  FEATURES_ENDPOINTS_DEFAULT_VALUES,
  FEATURES_ENDPOINTS_NAMES,
} from '@/src/constants/applications';
import {
  DEFAULT_APPLICATION_NAME,
  DEFAULT_TEMPERATURE,
} from '@/src/constants/default-ui-settings';
import { DEFAULT_EXTERNAL_APPS_SCHEMA_ID } from '@/src/constants/external-apps';
import { formErrors } from '@/src/constants/form-errors';
import { DEFAULT_VERSION } from '@/src/constants/publication';
import {
  DEFAULT_QUICK_APPS_MODEL,
  DEFAULT_QUICK_APPS_SCHEMA_2_ID,
  DEFAULT_QUICK_APPS_SCHEMA_ID,
  DialDeploymentToolsetToolTypes,
  ToolsetTypes,
} from '@/src/constants/quick-apps';
import {
  AttachmentTypesSchema,
  CompletionUrlSchema,
  DynamicFieldSchema,
  MarketplaceEntityBaseSchema,
  MaxInputAttachmentsSchema,
} from '@/src/constants/validation-helpers';

import { ShareEntity } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';
import { z as zodValidation } from 'zod';

export enum AppsEditorSchemaTypes {
  CustomApp = 'Custom app',
  ExternalApp = 'External app',
  QuickApp = 'Quick app',
  QuickApp2 = 'Quick app2',
  CodeApp = 'Code App',
}

export const MANDATORY_FIELD_PLACEHOLDER = 'MANDATORY_FIELD_PLACEHOLDER';

// Definition
export type BaseAppForm = zodValidation.infer<
  typeof MarketplaceEntityBaseSchema
>;

export const CustomAppSchema = zodValidation.object({
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
      } catch (error) {
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

export const ExternalAppSchema = zodValidation.object({
  type: zodValidation.literal(AppsEditorSchemaTypes.ExternalApp),
  externalUrl: CompletionUrlSchema.nonempty(formErrors.required).or(
    zodValidation.literal(MANDATORY_FIELD_PLACEHOLDER),
  ),
});
export type ExternalAppForm = zodValidation.infer<typeof ExternalAppSchema>;

export const QuickAppSchema = zodValidation.object({
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

export const QuickApp2Schema = zodValidation.object({
  type: zodValidation.literal(AppsEditorSchemaTypes.QuickApp2),
  instructions: zodValidation.string(),
  temperature: zodValidation.number(),
  documentRelativeUrl: zodValidation.array(zodValidation.string()),
  model: zodValidation.string(),
  agentsAndToolsets: zodValidation.array(zodValidation.string()),
  codeInterpreter: zodValidation.boolean(),
});
export type QuickApp2Form = zodValidation.infer<typeof QuickApp2Schema>;

export const CodeAppSchema = zodValidation
  .object({
    type: zodValidation.literal(AppsEditorSchemaTypes.CodeApp),
    inputAttachmentTypes: AttachmentTypesSchema,
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
    env: zodValidation.array(DynamicFieldSchema),
  })
  .superRefine((data, ctx) => {
    if (data.sources === MANDATORY_FIELD_PLACEHOLDER || !data.sources) return;

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
) &
  BaseAppForm;

// Implementation
const getBaseFormData = ({
  app,
  models,
}: {
  app?: CustomApplicationModel;
  models?: ShareEntity[];
}): BaseAppForm => ({
  name:
    app?.name ??
    getNextDefaultName(DEFAULT_APPLICATION_NAME, models ?? [], 0, true),
  version: app?.version ?? DEFAULT_VERSION,
  iconUrl: app?.iconUrl ?? '',
  description: app?.description ?? '',
  topics: app?.topics ?? [],
});

const getCustomAppFormData = (app?: CustomApplicationModel): CustomAppForm => ({
  type: AppsEditorSchemaTypes.CustomApp,
  inputAttachmentTypes: app?.inputAttachmentTypes ?? [],
  maxInputAttachments: app?.maxInputAttachments ?? undefined,
  completionUrl: app?.completionUrl || MANDATORY_FIELD_PLACEHOLDER,
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

const getQuickApp2FormData = (app?: CustomApplicationModel): QuickApp2Form => {
  const appProperties = app?.applicationProperties as QuickApp2Config;
  const agentToolsets =
    appProperties?.tool_sets
      ?.filter(isDialDeploymentToolset)
      ?.flatMap((toolset) => toolset.tools) ?? [];
  const mcpToolsets = appProperties?.tool_sets?.filter(isMcpToolset) ?? [];

  return {
    type: AppsEditorSchemaTypes.QuickApp2,
    documentRelativeUrl: getQuick2AppDocumentUrl(app) ?? [],
    model:
      appProperties?.orchestrator?.deployment?.name ??
      DefaultsService.get('quickAppsModel', DEFAULT_QUICK_APPS_MODEL),
    instructions: appProperties?.orchestrator?.system_prompt?.content ?? '',
    temperature:
      appProperties?.orchestrator?.deployment?.parameters?.temperature ??
      DEFAULT_TEMPERATURE,
    agentsAndToolsets: [
      ...agentToolsets.map((agentToolset) =>
        ApiUtils.decodeApiUrl(agentToolset.deployment_id),
      ),
      ...mcpToolsets.map((mcpToolset) =>
        ApiUtils.decodeApiUrl(mcpToolset.dial_id),
      ),
    ],
    codeInterpreter:
      appProperties?.tool_sets?.some(
        (toolset) => toolset.type === ToolsetTypes.CodeInterpreter,
      ) ?? false,
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
        },
      ],
  env: app?.function?.env
    ? Object.entries(app.function.env).map(([label, value]) => ({
        label,
        value,
        editableKey: true,
      }))
    : [],
});

const getExternalAppFormData = (
  app?: CustomApplicationModel,
): ExternalAppForm => ({
  type: AppsEditorSchemaTypes.ExternalApp,
  externalUrl:
    (app?.applicationProperties as ExternalAppConfig)?.external_url ||
    MANDATORY_FIELD_PLACEHOLDER,
});

const getEditorSchemaType = (type: string): AppsEditorSchemaTypes => {
  const quickAppSchemaId = DefaultsService.get(
    'quickAppsSchemaId',
    DEFAULT_QUICK_APPS_SCHEMA_ID,
  );
  const quickApp2SchemaId = DefaultsService.get(
    'quickAppsSchemaId2',
    DEFAULT_QUICK_APPS_SCHEMA_2_ID,
  );
  const externalAppSchemaId = DefaultsService.get(
    'externalAppsSchemaId',
    DEFAULT_EXTERNAL_APPS_SCHEMA_ID,
  );

  if (quickAppSchemaId.endsWith(type)) return AppsEditorSchemaTypes.QuickApp;
  if (quickApp2SchemaId.endsWith(type)) return AppsEditorSchemaTypes.QuickApp2;
  if (externalAppSchemaId.endsWith(type))
    return AppsEditorSchemaTypes.ExternalApp;

  if (type === ApplicationType.CODE_APP) return AppsEditorSchemaTypes.CodeApp;

  return AppsEditorSchemaTypes.CustomApp;
};

const getSettingsFormData = ({
  app,
  type,
  runtime,
}: {
  app?: CustomApplicationModel;
  type: AppsEditorSchemaTypes;
  runtime?: string;
}) => {
  switch (type) {
    case AppsEditorSchemaTypes.ExternalApp:
      return getExternalAppFormData(app);
    case AppsEditorSchemaTypes.CodeApp:
      return getCodeAppFormData({ app, runtime });
    case AppsEditorSchemaTypes.QuickApp:
      return getQuickAppFormData(app);
    case AppsEditorSchemaTypes.QuickApp2:
      return getQuickApp2FormData(app);
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
}: {
  type: string;
  app?: CustomApplicationModel;
  models?: ShareEntity[];
  runtime?: string;
}): AppsEditorFormType => ({
  ...getBaseFormData({ app, models }),
  ...getSettingsFormData({
    app,
    runtime,
    type: getEditorSchemaType(type),
  }),
});

export const getValidationSchema = (schemaType: string) => {
  const type = getEditorSchemaType(schemaType);
  switch (type) {
    case AppsEditorSchemaTypes.ExternalApp:
      return ExternalAppSchema.and(MarketplaceEntityBaseSchema);
    case AppsEditorSchemaTypes.CodeApp:
      return CodeAppSchema.and(MarketplaceEntityBaseSchema);
    case AppsEditorSchemaTypes.QuickApp:
      return QuickAppSchema.and(MarketplaceEntityBaseSchema);
    case AppsEditorSchemaTypes.QuickApp2:
      return QuickApp2Schema.and(MarketplaceEntityBaseSchema);
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

const getQuickApp2Toolsets = ({
  allEntitiesMap,
  data,
}: {
  allEntitiesMap: Record<string, MarketplaceEntity>;
  data: QuickApp2Form;
}): AnyToolset[] => {
  const { dialDeploymentsToolsets, dialMCPToolsets } =
    data.agentsAndToolsets.reduce<{
      dialDeploymentsToolsets: DialDeploymentSimpleTool[];
      dialMCPToolsets: MCPToolset[];
    }>(
      (acc, agentAndToolset) => {
        const entity = allEntitiesMap[agentAndToolset];
        if (!entity) return acc;

        if (isDialAiEntityModel(entity)) {
          acc.dialDeploymentsToolsets.push({
            type: DialDeploymentToolsetToolTypes.DialDeploymentSimple,
            deployment_id: ApiUtils.encodeApiUrl(entity.id),
          });
        } else {
          acc.dialMCPToolsets.push({
            name: entity.name,
            dial_id: ApiUtils.encodeApiUrl(entity.id),
            description: entity.description,
            type: ToolsetTypes.DialMcp,
            transport: entity.transport,
          });
        }

        return acc;
      },
      { dialDeploymentsToolsets: [], dialMCPToolsets: [] },
    );

  return [
    ...dialMCPToolsets,
    {
      name: 'dial-deployment-tool-set',
      type: ToolsetTypes.DialDeployment,
      tools: [...dialDeploymentsToolsets],
    },
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
}: {
  data: AppsEditorFormType;
  allEntitiesMap: Record<string, MarketplaceEntity>;
  currentApp?: CustomApplicationModel;
}): CustomApplicationModel => {
  const generalData = {
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
  };

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
          env: data.env.length
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
        applicationProperties:
          data.externalUrl === MANDATORY_FIELD_PLACEHOLDER || !data.externalUrl
            ? undefined
            : {
                external_url: data.externalUrl,
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
    case AppsEditorSchemaTypes.QuickApp2:
      return {
        ...generalData,
        applicationProperties: {
          orchestrator: {
            deployment: {
              name: allEntitiesMap[data.model]?.id ?? data.model,
              parameters: {
                temperature: data.temperature,
              },
            },
            system_prompt: {
              type: 'custom',
              variables: {},
              content: data.instructions,
            },
          },
          contexts:
            data.documentRelativeUrl?.map((url) => ({
              url,
              type: 'file',
            })) ?? [],
          tool_sets: getQuickApp2Toolsets({ data, allEntitiesMap }),
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
