import { getNextDefaultName } from '@/src/utils/app/folders';

import { ToolsetModel } from '@/src/types/toolsets';

import { DEFAULT_TOOLSET_NAME } from '@/src/constants/default-ui-settings';
import { formErrors, urlErrors } from '@/src/constants/form-errors';
import { DEFAULT_VERSION } from '@/src/constants/publication';
import { MarketplaceEntityBaseSchema } from '@/src/constants/validation-helpers';

import { ToolsetAuthTypes, ToolsetTransportType } from '@epam/ai-dial-shared';
import { z as zodValidation } from 'zod';

export const ENDPOINT_PLACEHOLDER = 'ENDPOINT_PLACEHOLDER';

export const ToolsetLoginFormSchema = zodValidation
  .object({
    includeOAuthFields: zodValidation.boolean().optional(),
    authenticationType: zodValidation.enum(ToolsetAuthTypes),
    // API_KEY
    keyHeader: zodValidation.string().optional(),
    apiKey: zodValidation.string().optional(),
    // OAuth
    clientId: zodValidation.string().optional(),
    clientSecret: zodValidation.string().optional(),
    authorizationEndpoint: zodValidation.string().optional(),
    tokenEndpoint: zodValidation.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.authenticationType === ToolsetAuthTypes.API_KEY) {
      if (!data.keyHeader?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['keyHeader'],
          message: 'Key name is required',
        });
      }
      if (!data.apiKey?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['apiKey'],
          message: 'API key is required',
        });
      }
    }
    if (data.authenticationType === ToolsetAuthTypes.OAUTH) {
      if (!data.clientId && data.includeOAuthFields) {
        ctx.addIssue({
          code: 'custom',
          path: ['clientId'],
          message: 'Client ID is required',
        });
      }
      if (!data.clientSecret && data.includeOAuthFields) {
        ctx.addIssue({
          code: 'custom',
          path: ['clientSecret'],
          message: 'Client secret is required',
        });
      }
    }
  }); // TODO: add login & password schema when ready
export type ToolsetLoginFormType = zodValidation.infer<
  typeof ToolsetLoginFormSchema
>;

export const ToolsetEditorFormSchema = zodValidation
  .object({
    endpoint: zodValidation
      .string()
      .trim()
      .nonempty(formErrors.required)
      .regex(/^(https?|sse):\/\//, {
        error: urlErrors.notValidProtocol,
      })
      .refine(
        (str) => !str.endsWith('.') && !str.endsWith('//'),
        urlErrors.notValidEnding,
      )
      .refine((str) => {
        try {
          const url = new URL(str);
          return !!url;
        } catch {
          return false;
        }
      }, urlErrors.notValidUrl)
      .or(zodValidation.literal(ENDPOINT_PLACEHOLDER)),
    protocol: zodValidation.enum(ToolsetTransportType),
    allowedTools: zodValidation.array(zodValidation.string()),
  })
  .and(MarketplaceEntityBaseSchema)
  .and(ToolsetLoginFormSchema);

export type ToolsetEditorForm = zodValidation.infer<
  typeof ToolsetEditorFormSchema
>;

export const getDefaultLoginFormData = (
  authenticationType: ToolsetAuthTypes,
  toolset?: ToolsetModel,
  prevData?: ToolsetLoginFormType,
): ToolsetLoginFormType => {
  switch (authenticationType) {
    case ToolsetAuthTypes.API_KEY:
      return {
        authenticationType,
        keyHeader: toolset?.authSettings?.apiKeyHeader ?? 'api_key',
        apiKey: prevData?.apiKey ?? '',
      };
    case ToolsetAuthTypes.OAUTH:
      return {
        authenticationType,
        clientId: toolset?.authSettings?.clientId ?? '',
        clientSecret: toolset?.authSettings?.clientSecret ?? '',
        authorizationEndpoint:
          toolset?.authSettings?.authorizationEndpoint ?? '',
        tokenEndpoint: toolset?.authSettings?.tokenEndpoint ?? '',
        includeOAuthFields:
          !prevData &&
          toolset?.authSettings?.clientSecret &&
          toolset?.authSettings?.clientId
            ? true
            : (prevData?.includeOAuthFields ?? false),
      };
    case ToolsetAuthTypes.NONE:
    default:
      return {
        authenticationType,
      };
  }
};

export const getDefaultFormData = (
  toolset?: ToolsetModel,
  toolsets?: ToolsetModel[],
  prevData?: ToolsetEditorForm,
): ToolsetEditorForm => {
  return {
    name:
      toolset?.name ??
      getNextDefaultName(DEFAULT_TOOLSET_NAME, toolsets ?? [], 0, true),
    endpoint: toolset?.endpoint ?? ENDPOINT_PLACEHOLDER,
    protocol: toolset?.transport ?? ToolsetTransportType.SSE,
    description: toolset?.description ?? '',
    allowedTools: toolset?.allowedTools ?? [],
    iconUrl: toolset?.iconUrl ?? '',
    version: toolset?.version ?? DEFAULT_VERSION,
    topics: toolset?.topics ?? [],

    ...getDefaultLoginFormData(
      toolset?.authSettings?.authenticationType ?? ToolsetAuthTypes.NONE,
      toolset,
      prevData,
    ),
  };
};
