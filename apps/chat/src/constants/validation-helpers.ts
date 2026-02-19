import {
  doesHaveDotsInTheEnd,
  isVersionPartSizeValid,
  isVersionValid,
} from '@/src/utils/app/common';
import { notAllowedSpaces, notAllowedSymbols } from '@/src/utils/app/file';

import {
  MAX_ENTITY_LENGTH,
  MIN_ENTITY_LENGTH,
} from '@/src/constants/default-ui-settings';
import { MIME_FORMAT_REGEX } from '@/src/constants/file';
import {
  formErrors,
  urlErrors,
  versionsErrors,
} from '@/src/constants/form-errors';

import escapeRegExp from 'lodash-es/escapeRegExp';
import { z as zodValidation } from 'zod';

const specialCharactersRegex = new RegExp(
  `[${escapeRegExp(notAllowedSymbols)}]|${notAllowedSpaces}`,
);

export const getEntityNameSchema = (options: {
  name: string;
  checkDotsInTheEnd?: boolean;
  skipCheckRestrictedSymbols?: boolean;
}) =>
  zodValidation
    .string()
    .trim()
    .nonempty(formErrors.required)
    .min(
      MIN_ENTITY_LENGTH,
      formErrors.tooShort(options.name, MIN_ENTITY_LENGTH),
    )
    .max(MAX_ENTITY_LENGTH, formErrors.tooLong(options.name, MAX_ENTITY_LENGTH))
    .refine(
      (str) =>
        options.skipCheckRestrictedSymbols || !specialCharactersRegex.test(str),
      formErrors.hasSpecialCharacters(options.name),
    )
    .refine(
      (str) => !options.checkDotsInTheEnd || !doesHaveDotsInTheEnd(str),
      formErrors.noDotInTheEnd(options.name),
    );

export const MarketplaceEntityBaseSchema = zodValidation.object({
  name: getEntityNameSchema({ name: 'Name', checkDotsInTheEnd: true }),
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

export const MaxInputAttachmentsSchema = zodValidation.coerce
  .number<number>()
  .refine((v) => {
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
  id: zodValidation.string().optional(),
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
