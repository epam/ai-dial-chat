import {
  getLocalizedEntityIdName,
  parseLocalizedDescription,
} from '@/src/utils/app/application';
import {
  getStorageSafeUniqueToolsetName,
  isToolsetSignedIn,
} from '@/src/utils/app/toolsets';
import { zodValidation } from '@/src/utils/zod-config-wrapper';

import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';

import { DEFAULT_TOOLSET_NAME } from '@/src/constants/default-ui-settings';
import { formErrors, urlErrors } from '@/src/constants/form-errors';
import { DEFAULT_VERSION } from '@/src/constants/publication';
import { MarketplaceEntityBaseSchema } from '@/src/constants/validation-helpers';

import {
  TokenEndpointAuthMethod,
  ToolsetAuthTypes,
  ToolsetTransportType,
} from '@epam/ai-dial-shared';

export const ENDPOINT_PLACEHOLDER = 'ENDPOINT_PLACEHOLDER';

export enum WithLogin {
  WithLogin = 'With login',
  WithoutLogin = 'Without login',
  WithConfig = 'With login & config',
}

export const ToolsetLoginFormSchema = zodValidation
  .object({
    withLogin: zodValidation.enum(WithLogin),
    authenticationType: zodValidation.enum(ToolsetAuthTypes),
    isLoggedIn: zodValidation.boolean(),
    // API_KEY
    keyHeader: zodValidation.string().optional(),
    apiKey: zodValidation.string().optional(),
    // OAuth
    clientId: zodValidation.string().optional(),
    clientSecret: zodValidation.string().optional(),
    authorizationEndpoint: zodValidation.string().optional(),
    tokenEndpoint: zodValidation.string().optional(),
    tokenEndpointAuthMethod: zodValidation
      .enum(TokenEndpointAuthMethod)
      .optional(),
    scopes: zodValidation.array(zodValidation.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isLoggedIn) return;
    if (data.authenticationType === ToolsetAuthTypes.API_KEY) {
      if (!data.keyHeader?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['keyHeader'],
          message: 'Key name is required',
        });
      }
      if (!data.apiKey?.trim() && data.withLogin === WithLogin.WithLogin) {
        ctx.addIssue({
          code: 'custom',
          path: ['apiKey'],
          message: 'API key is required',
        });
      }
    }
    if (
      data.authenticationType === ToolsetAuthTypes.OAUTH &&
      data.withLogin === WithLogin.WithConfig
    ) {
      if (!data.clientId?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['clientId'],
          message: 'Client ID is required',
        });
      }
      if (!data.clientSecret?.trim()) {
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

export const getDefaultLoginFormData = ({
  authenticationType,
  toolset,
  prevData,
  authLevel,
  isAdminReview,
}: {
  authenticationType: ToolsetAuthTypes;
  toolset?: ToolsetModel;
  prevData?: Partial<ToolsetLoginFormType>;
  authLevel?: ToolsetCredentialsLevel;
  isAdminReview?: boolean;
}): ToolsetLoginFormType => {
  const isLoggedIn = toolset ? isToolsetSignedIn(toolset, authLevel) : false;

  switch (authenticationType) {
    case ToolsetAuthTypes.API_KEY:
      return {
        authenticationType,
        isLoggedIn,
        withLogin:
          isAdminReview && !isLoggedIn
            ? WithLogin.WithoutLogin
            : (prevData?.withLogin ?? WithLogin.WithLogin),
        keyHeader: toolset?.authSettings?.apiKeyHeader ?? '',
        apiKey: prevData?.apiKey ?? '',
      };
    case ToolsetAuthTypes.OAUTH:
      return {
        authenticationType,
        isLoggedIn,
        clientId: toolset?.authSettings?.clientId ?? '',
        clientSecret: toolset?.authSettings?.clientSecret ?? '',
        authorizationEndpoint:
          toolset?.authSettings?.authorizationEndpoint ?? '',
        tokenEndpoint: toolset?.authSettings?.tokenEndpoint ?? '',
        tokenEndpointAuthMethod:
          toolset?.authSettings?.tokenEndpointAuthMethod ??
          TokenEndpointAuthMethod.ClientSecretPost,
        withLogin:
          !prevData &&
          toolset?.authSettings?.clientSecret &&
          toolset?.authSettings?.clientId
            ? WithLogin.WithConfig
            : (prevData?.withLogin ?? WithLogin.WithLogin),
        scopes: toolset?.authSettings?.scopesSupported,
      };
    case ToolsetAuthTypes.NONE:
    default:
      return {
        isLoggedIn,
        withLogin: WithLogin.WithoutLogin,
        authenticationType,
      };
  }
};

export const getDefaultFormData = ({
  toolset,
  toolsets,
  prevData,
  isAdminReview,
  locale,
}: {
  toolset?: ToolsetModel;
  toolsets?: ToolsetModel[];
  prevData?: ToolsetEditorForm;
  isAdminReview?: boolean;
  locale: string;
}): ToolsetEditorForm => {
  return {
    name:
      getLocalizedEntityIdName(toolset?.name) ||
      (getStorageSafeUniqueToolsetName({
        toolset: {
          name: '',
          version: toolset?.version ?? DEFAULT_VERSION,
          folderId: toolset?.folderId,
          id: toolset?.id,
        },
        defaultName: DEFAULT_TOOLSET_NAME,
        existingNames: (toolsets ?? []).map((t) =>
          getLocalizedEntityIdName(t.name),
        ),
      }) ??
        DEFAULT_TOOLSET_NAME),
    endpoint: toolset ? (toolset.endpoint ?? '') : ENDPOINT_PLACEHOLDER,
    protocol: toolset?.transport ?? ToolsetTransportType.HTTP,
    description: parseLocalizedDescription(locale, toolset?.description),
    allowedTools: toolset?.allowedTools ?? [],
    iconUrl: toolset?.iconUrl ?? '',
    version: toolset ? (toolset.version ?? '') : DEFAULT_VERSION,
    topics: toolset?.topics ?? [],

    ...getDefaultLoginFormData({
      authenticationType:
        toolset?.authSettings?.authenticationType ?? ToolsetAuthTypes.NONE,
      toolset,
      prevData,
      isAdminReview,
    }),
  };
};
