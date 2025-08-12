import { notAllowedSymbols } from '@/src/utils/app/file';
import { getNextDefaultName } from '@/src/utils/app/folders';

import { ToolsetModel } from '@/src/types/toolsets';

import { DEFAULT_TOOLSET_NAME } from '@/src/constants/default-ui-settings';

import { ToolsetTransportType } from '@epam/ai-dial-shared';
import { z } from 'zod';

export const ENDPOINT_PLACEHOLDER = 'ENDPOINT_PLACEHOLDER';

export const ToolsetEditorFormSchema = z.object({
  name: z
    .string()
    .nonempty('This field is required')
    .regex(new RegExp(`^[^${notAllowedSymbols}]+$`), {
      error: 'Name should not contain special characters',
    })
    .min(2, 'Name should be at least 2 characters long')
    .max(160, 'Name should not be longer than 160 characters'),
  endpoint: z
    .string()
    .nonempty('Endpoint is required')
    .regex(/^(https?|sse):\/\//, {
      error: 'Endpoint must start with a valid protocol',
    })
    .refine(
      (str) => !str.endsWith('.') && !str.endsWith('//'),
      'Endpoint cannot end with . or //',
    )
    .refine((str) => {
      try {
        const url = new URL(str);
        return !!url;
      } catch {
        return false;
      }
    }, 'Endpoint should be a valid URL')
    .or(z.literal(ENDPOINT_PLACEHOLDER)),
  protocol: z.enum(ToolsetTransportType),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, {
      message:
        'Version should be in x.y.z format and contain only numbers and dots.',
    })
    .refine((v) => v.split('.').every((part) => part.length <= 5), {
      message:
        'Each part of the version should contain no more than five numbers.',
    }),
  description: z.string(),
  allowedTools: z.array(z.string()),
  iconUrl: z.string(),
  topics: z.array(z.string()),
});

export type ToolsetEditorForm = z.infer<typeof ToolsetEditorFormSchema>;

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
    description: toolset?.description ?? '',
    allowedTools: toolset?.allowedTools ?? [],
    iconUrl: toolset?.iconUrl ?? '',
    version: toolset?.version ?? '',
    topics: toolset?.topics ?? [],
  };
};
