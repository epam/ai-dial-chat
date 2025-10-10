import { isVersionPartSizeValid, isVersionValid } from '@/src/utils/app/common';
import { doesHaveNotAllowedSymbols } from '@/src/utils/app/file';

import { MIME_FORMAT_REGEX } from '@/src/constants/file';
import {
  formErrors,
  urlErrors,
  versionsErrors,
} from '@/src/constants/form-errors';

import { z as zodValidation } from 'zod';

export const MarketplaceEntityBaseSchema = zodValidation.object({
  name: zodValidation
    .string()
    .trim()
    .nonempty(formErrors.required)
    .min(2, formErrors.tooShort('Name', 2))
    .max(160, formErrors.tooLong('Name', 160))
    .refine(
      (str) => !doesHaveNotAllowedSymbols(str),
      formErrors.hasSpecialCharacters(),
    ),
  version: zodValidation
    .string()
    .nonempty(versionsErrors.required)
    .refine(isVersionValid, versionsErrors.notValid)
    .refine(isVersionPartSizeValid, versionsErrors.tooLongPart),
  description: zodValidation.string(),
  iconUrl: zodValidation.string(),
  topics: zodValidation.array(zodValidation.string()),
});

export const AttachmentTypesSchema = zodValidation
  .array(zodValidation.string())
  .refine(
    (types) => types.every((t) => MIME_FORMAT_REGEX.test(t)),
    'Please match the MIME format',
  );

export const MaxInputAttachmentsSchema = zodValidation.number().refine((v) => {
  if (!v) return true;
  const reg = /^[0-9]+$/;
  return reg.test(String(v));
}, 'Max attachments must be a number');

export const DynamicFieldSchema = zodValidation.object({
  label: zodValidation
    .string()
    .nonempty('Key is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Enter only valid symbols'),
  value: zodValidation.string().nonempty('Value is required'),
  defaultValue: zodValidation.string().optional(),
  editableKey: zodValidation.boolean().optional(),
  static: zodValidation.boolean().optional(),
  visibleName: zodValidation.string().optional(),
});

export const CompletionUrlSchema = zodValidation
  .string()
  .regex(/^(http?|https):\/\//, {
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
  }, urlErrors.notValidUrl);
