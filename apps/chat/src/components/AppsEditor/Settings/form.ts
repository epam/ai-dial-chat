import {
  Path,
  RegisterOptions,
  UseFormClearErrors,
  UseFormSetError,
} from 'react-hook-form';

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
import { ApiUtils } from '@/src/utils/server/api';

import {
  ApplicationPropertiesType,
  CustomApplicationModel,
  ExternalAppConfig,
  ExternalAppModel,
  Toolsets,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { ModelsMap } from '@/src/types/models';
import {
  DialDeploymentSimpleTool,
  FileContext,
  MCPToolset,
  QuickApp2Config,
  QuickAppConfig,
  isDialDeploymentToolset,
  isMcpToolset,
} from '@/src/types/quick-apps';

import {
  FEATURES_ENDPOINTS,
  FEATURES_ENDPOINTS_DEFAULT_VALUES,
  FEATURES_ENDPOINTS_NAMES,
} from '@/src/constants/applications';
import { DEFAULT_TEMPERATURE } from '@/src/constants/default-ui-settings';
import {
  DEFAULT_QUICK_APPS_MODEL,
  DialDeploymentToolsetToolTypes,
  ToolsetTypes,
} from '@/src/constants/quick-apps';

import { DynamicField } from '@/src/components/Common/Forms/DynamicFormFields';

interface ApplicationGeneralInfo {
  name: string;
  version: string;
  iconUrl: string;
  description: string;
  topics: string[];
  id: string;
  reference: string;
  completionUrl: string;
}

export interface CustomApplicationFormData extends ApplicationGeneralInfo {
  inputAttachmentTypes: string[];
  completionUrl: string;
  features: string | null;
  maxInputAttachments?: number | '';
  applicationProperties: ApplicationPropertiesType;
}

export interface ExternalAppFormData extends ApplicationGeneralInfo {
  externalUrl: string;
  applicationProperties: ApplicationPropertiesType;
}

export interface QuickAppFormData extends ApplicationGeneralInfo {
  instructions: string;
  temperature: number;
  [Toolsets.WebApiToolset]: string;
  [Toolsets.McpToolset]?: string;
  documentRelativeUrl?: string[];
  model: string;
}

export interface QuickAppFormData2
  extends Omit<ApplicationGeneralInfo, 'completionUrl'> {
  instructions: string;
  temperature: number;
  documentRelativeUrl?: string[];
  model: string;
  agentsAndToolsets: string[];
  codeInterpreter: boolean;
}

export interface CodeAppFormData extends ApplicationGeneralInfo {
  inputAttachmentTypes: string[];
  sources: string;
  sourceFiles?: string[];
  runtime: string;
  endpoints: DynamicField[];
  maxInputAttachments?: number | '';
  env: DynamicField[];
}

export type FormDataType =
  | CustomApplicationFormData
  | QuickAppFormData
  | CodeAppFormData
  | ExternalAppFormData;

const getMappingsKeyOptions = (name: 'endpoints' | 'env') => ({
  validate: (v: string, data: CodeAppFormData) => {
    const reg = /^[a-zA-Z0-9_-]+$/;

    if (!v.trim()) return 'Key is required';
    if (!reg.test(v)) return 'Enter only valid symbols';
    if (data[name].filter(({ label }) => label === v.trim()).length > 1) {
      return 'Key must be unique';
    }

    return true;
  },
});

// TODO: implement better way to write types for nested array fields
export const endpointsKeyValidator = getMappingsKeyOptions(
  'endpoints',
) as unknown as RegisterOptions<CodeAppFormData, Path<CodeAppFormData>>;
export const envKeysValidator = getMappingsKeyOptions(
  'env',
) as unknown as RegisterOptions<CodeAppFormData, Path<CodeAppFormData>>;
export const endpointsValueValidator = {
  validate: (value: string) => {
    const reg = /^[a-zA-Z0-9/_-]+$/;
    const val = value.trim();

    if (!val) return 'Endpoint is required';
    if (!val.startsWith('/')) return "Endpoint should start with '/'";
    if (!reg.test(val))
      return "Endpoint should contain only letters, numbers, '-', '_' and '/'";
    if (val.length > 255)
      return 'Endpoint should be no longer than 255 characters';

    return true;
  },
} as RegisterOptions<CodeAppFormData, Path<CodeAppFormData>>;
export const envValueValidator = {
  required: 'Value is required',
} as RegisterOptions<CodeAppFormData, Path<CodeAppFormData>>;

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

const getApplicationGeneralDefaultValues = (app: CustomApplicationModel) => {
  return {
    name: app.name,
    id: app.id,
    description: app.description ?? '',
    version: app.version,
    iconUrl: app.iconUrl ?? '',
    topics: app.topics ?? [],
    reference: app.reference,
  };
};

export const getFormSourceFolder = (sourceFolder?: string) => {
  const bucket = BucketService.getBucket();

  return sourceFolder && sourceFolder !== `files/${bucket}`
    ? ApiUtils.decodeApiUrl(sourceFolder)
    : '';
};
const getActualSourceFolder = (formSources?: string) => {
  const bucket = BucketService.getBucket();

  return formSources || `files/${bucket}`;
};

export const getCodeAppDefaultValues = ({
  app,
  runtime,
}: {
  app: CustomApplicationModel;
  runtime?: string;
}): CodeAppFormData => {
  return {
    ...getApplicationGeneralDefaultValues(app),
    id: decodeURIComponent(app.name),
    reference: app.reference,
    completionUrl: app.completionUrl ?? '',
    inputAttachmentTypes: app.inputAttachmentTypes ?? [],
    maxInputAttachments: app.maxInputAttachments,
    sources: getFormSourceFolder(app.function?.sourceFolder),
    runtime: app?.function?.runtime ?? runtime ?? 'python3.11',
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
  };
};

export const getCustomApplicationDefaultValues = ({
  app,
}: {
  app: CustomApplicationModel;
}): CustomApplicationFormData => ({
  ...getApplicationGeneralDefaultValues(app),
  inputAttachmentTypes: app.inputAttachmentTypes ?? [],
  maxInputAttachments: app.maxInputAttachments,
  completionUrl: app.completionUrl ?? '',
  features: safeStringifyApplicationFeatures(app.features),
  applicationProperties: app.applicationProperties ?? null,
});

export const getQuickAppDefaultValues = ({
  app,
}: {
  app: CustomApplicationModel;
}): QuickAppFormData => {
  const appProperties = app.applicationProperties as QuickAppConfig;
  return {
    ...getApplicationGeneralDefaultValues(app),
    completionUrl: app.completionUrl ?? '',
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

export const getQuickAppDefaultValues2 = ({
  app,
}: {
  app: CustomApplicationModel;
}): QuickAppFormData2 => {
  const appProperties = app.applicationProperties as QuickApp2Config;
  const agentToolsets = appProperties.tool_sets
    .filter(isDialDeploymentToolset)
    .flatMap((toolset) => toolset.tools);

  const mcpToolsets = appProperties.tool_sets.filter(isMcpToolset);

  return {
    ...getApplicationGeneralDefaultValues(app),
    documentRelativeUrl: getQuick2AppDocumentUrl(app) ?? [],
    model:
      appProperties.orchestrator.deployment.name ??
      DefaultsService.get('quickAppsModel', DEFAULT_QUICK_APPS_MODEL),
    instructions: appProperties.orchestrator.system_prompt.content ?? '',
    temperature:
      appProperties.orchestrator.deployment.parameters?.temperature ??
      DEFAULT_TEMPERATURE,
    agentsAndToolsets: [
      ...agentToolsets.map((agentToolset) => agentToolset.deployment_id),
      ...mcpToolsets.map((mcpToolset) => mcpToolset.dial_id),
    ],
    codeInterpreter: appProperties.tool_sets.some(
      (toolset) => toolset.type === ToolsetTypes.CodeInterpreter,
    ),
  };
};

export const getExternalAppDefaultValues = ({
  app,
}: {
  app: CustomApplicationModel;
}): ExternalAppFormData => {
  return {
    ...getApplicationGeneralDefaultValues(app),
    externalUrl:
      (app.applicationProperties as ExternalAppConfig)?.external_url ?? '',
    completionUrl: app.completionUrl ?? '',
    applicationProperties: app.applicationProperties ?? null,
  };
};

const getGeneralApplicationData = (
  formData:
    | CustomApplicationFormData
    | QuickAppFormData
    | QuickAppFormData2
    | CodeAppFormData
    | ExternalAppFormData,
) => ({
  type: EntityType.Application,
  name: formData.name,
  iconUrl: formData.iconUrl,
  topics: formData.topics,
  description: formData.description,
  version: formData.version,
});

export const getCodeAppData = (
  formData: CodeAppFormData,
): Omit<CustomApplicationModel, 'id' | 'reference'> => {
  return {
    ...getGeneralApplicationData(formData),
    isDefault: false,
    folderId: '',
    completionUrl: '',
    applicationProperties: undefined,
    inputAttachmentTypes: formData.inputAttachmentTypes,
    maxInputAttachments: formData.maxInputAttachments
      ? Number(formData.maxInputAttachments)
      : undefined,
    function: {
      sourceFolder: getActualSourceFolder(formData.sources),
      mapping: formData.endpoints.reduce(
        (acc, option) => ({
          ...acc,
          [option.label]: option.value.trim(),
        }),
        {},
      ),
      env: formData.env.length
        ? formData.env.reduce(
            (acc, option) => ({
              ...acc,
              [option.label]: option.value,
            }),
            {},
          )
        : undefined,
      runtime: formData.runtime,
    },
  };
};

export const getCustomApplicationData = (
  formData: CustomApplicationFormData,
): Omit<CustomApplicationModel, 'id' | 'reference'> => {
  const preparedData: Omit<CustomApplicationModel, 'id' | 'reference'> = {
    ...getGeneralApplicationData(formData),

    isDefault: false,
    folderId: '',
    applicationProperties: formData.applicationProperties ?? undefined,
    completionUrl: formData.completionUrl,
    inputAttachmentTypes: formData.inputAttachmentTypes,
    maxInputAttachments: formData.maxInputAttachments
      ? Number(formData.maxInputAttachments)
      : undefined,
    features: formData.features ? JSON.parse(formData.features) : null,
  };
  return preparedData;
};

export const getExternalAppData = (
  formData: ExternalAppFormData,
): Omit<ExternalAppModel, 'id' | 'reference'> => {
  const preparedData: Omit<ExternalAppModel, 'id' | 'reference'> = {
    ...getGeneralApplicationData(formData),

    isDefault: false,
    folderId: '',
    applicationProperties: {
      external_url: formData.externalUrl,
    },
  };
  return preparedData;
};

export const getQuickAppData = (
  formData: QuickAppFormData,
  modelsMap: ModelsMap,
): Omit<CustomApplicationModel, 'id' | 'reference' | 'completionUrl'> => {
  return {
    ...getGeneralApplicationData(formData),
    applicationProperties: {
      instructions: formData.instructions,
      temperature: formData.temperature,
      web_api_toolset: JSON.parse(formData[Toolsets.WebApiToolset]),
      ...(formData[Toolsets.McpToolset] && {
        mcp_toolset: JSON.parse(formData[Toolsets.McpToolset]),
      }),
      model: modelsMap[formData.model]?.id ?? formData.model,
      document_relative_url: formData.documentRelativeUrl,
    },
    isDefault: false,
    folderId: '',
  };
};

export const getQuickAppData2 = (
  formData: QuickAppFormData2,
  modelsMap: ModelsMap,
  allEntitiesMap: Record<string, MarketplaceEntity | undefined>,
): Omit<CustomApplicationModel, 'id' | 'reference' | 'completionUrl'> => {
  const documentRelativeUrls: FileContext[] =
    formData.documentRelativeUrl?.map((url) => ({
      url,
      type: 'file',
    })) ?? [];
  const { dialDeploymentsToolsets, dialMCPToolsets } =
    formData.agentsAndToolsets.reduce<{
      dialDeploymentsToolsets: DialDeploymentSimpleTool[];
      dialMCPToolsets: MCPToolset[];
    }>(
      (acc, agentAndToolset) => {
        const entity = allEntitiesMap[agentAndToolset];
        if (!entity) return acc;

        if (isDialAiEntityModel(entity)) {
          acc.dialDeploymentsToolsets.push({
            type: DialDeploymentToolsetToolTypes.DialDeploymentSimple,
            deployment_id: entity.id,
          });
        } else {
          acc.dialMCPToolsets.push({
            name: entity.name,
            dial_id: entity.id,
            description: entity.description,
            type: ToolsetTypes.DialMcp,
            transport: entity.transport,
          });
        }

        return acc;
      },
      { dialDeploymentsToolsets: [], dialMCPToolsets: [] },
    );

  return {
    ...getGeneralApplicationData(formData),
    applicationProperties: {
      orchestrator: {
        deployment: {
          name: modelsMap[formData.model]?.id ?? formData.model,
          parameters: {
            temperature: formData.temperature,
          },
        },
        system_prompt: {
          type: 'custom',
          variables: {},
          content: formData.instructions,
        },
      },
      contexts: documentRelativeUrls,
      tool_sets: [
        ...dialMCPToolsets,
        {
          name: 'dial-deployment-tool-set',
          type: ToolsetTypes.DialDeployment,
          tools: [...dialDeploymentsToolsets],
        },
        ...(formData.codeInterpreter
          ? [
              {
                template_name: 'py_interpreter',
                type: ToolsetTypes.CodeInterpreter,
              },
            ]
          : []),
      ],
    },
    isDefault: false,
    folderId: '',
  };
};
