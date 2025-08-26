import { isVersionPartSizeValid, isVersionValid } from '@/src/utils/app/common';
import { doesHaveNotAllowedSymbols } from '@/src/utils/app/file';
import { getNextDefaultName } from '@/src/utils/app/folders';

import { ToolsetModel } from '@/src/types/toolsets';

import { DEFAULT_TOOLSET_NAME } from '@/src/constants/default-ui-settings';
import {
  formErrors,
  urlErrors,
  versionsErrors,
} from '@/src/constants/form-errors';
import { DEFAULT_VERSION } from '@/src/constants/publication';

import { ToolsetAuthTypes, ToolsetTransportType } from '@epam/ai-dial-shared';
import { z as zodValidation } from 'zod';

export const ENDPOINT_PLACEHOLDER = 'ENDPOINT_PLACEHOLDER';

export const ToolsetEditorFormSchema = zodValidation.object({
  name: zodValidation
    .string()
    .nonempty(formErrors.required)
    .min(2, formErrors.tooShort('Name', 2))
    .max(160, formErrors.tooLong('Name', 160))
    .refine(
      (str) => !doesHaveNotAllowedSymbols(str),
      formErrors.hasSpecialCharacters(),
    ),
  endpoint: zodValidation
    .string()
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
  version: zodValidation
    .string()
    .nonempty(versionsErrors.required)
    .refine(isVersionValid, versionsErrors.notValid)
    .refine(isVersionPartSizeValid, versionsErrors.tooLongPart),
  description: zodValidation.string(),
  allowedTools: zodValidation.array(zodValidation.string()),
  iconUrl: zodValidation.string(),
  topics: zodValidation.array(zodValidation.string()),
  authenticationType: zodValidation.enum(ToolsetAuthTypes),
});

export type ToolsetEditorForm = zodValidation.infer<
  typeof ToolsetEditorFormSchema
>;

export const getDefaultFormData = (
  toolset?: ToolsetModel,
  toolsets?: ToolsetModel[],
): ToolsetEditorForm => {
  return {
    name:
      toolset?.name ??
      getNextDefaultName(DEFAULT_TOOLSET_NAME, toolsets ?? [], 0, true),
    endpoint: toolset?.endpoint ?? ENDPOINT_PLACEHOLDER,
    protocol: toolset?.transport ?? ToolsetTransportType.SSE,
    authenticationType:
      toolset?.authSettings?.authenticationType ?? ToolsetAuthTypes.OAUTH,
    description: toolset?.description ?? '',
    allowedTools: toolset?.allowedTools ?? [],
    iconUrl: toolset?.iconUrl ?? '',
    version: toolset?.version ?? DEFAULT_VERSION,
    topics: toolset?.topics ?? [],
  };
};

export const ToolsetLoginFormSchema = zodValidation
  .object({
    type: zodValidation.enum(ToolsetAuthTypes),
    keyHeader: zodValidation.string().optional(),
    apiKey: zodValidation.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === ToolsetAuthTypes.API_KEY) {
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
  }); // TODO: add login & password schema when ready
export type ToolsetLoginFormType = zodValidation.infer<
  typeof ToolsetLoginFormSchema
>;
