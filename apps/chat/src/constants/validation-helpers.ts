import {
  doesHaveDotsInTheEnd,
  doesHaveDotsInTheStart,
  getUtf8BytesLength,
  isVersionPartSizeValid,
  isVersionValid,
} from '@/src/utils/app/common';
import { notAllowedSpaces, notAllowedSymbols } from '@/src/utils/app/file';
import { getResourceMaxSegmentBytes } from '@/src/utils/app/resource-limits';
import { getMarketplaceEntityApiKey } from '@/src/utils/server/api';
import { zodValidation } from '@/src/utils/zod-config-wrapper';

import { MIN_ENTITY_LENGTH } from '@/src/constants/default-ui-settings';
import { MIME_FORMAT_REGEX } from '@/src/constants/file';
import {
  formErrors,
  urlErrors,
  versionsErrors,
} from '@/src/constants/form-errors';

import escapeRegExp from 'lodash-es/escapeRegExp';

const specialCharactersRegex = new RegExp(
  `[${escapeRegExp(notAllowedSymbols)}]|${notAllowedSpaces}`,
);

export const getEntityNameSchema = (options: {
  name: string;
  checkDotsInTheEnd?: boolean;
  skipCheckRestrictedSymbols?: boolean;
  checkDotsInTheStart?: boolean;
  maxBytes?: number;
  buildNameForByteValidation?: (preparedName: string) => string;
  skipMaxBytesCheck?: boolean;
}) =>
  zodValidation
    .string()
    .trim()
    .nonempty(formErrors.required)
    .min(
      MIN_ENTITY_LENGTH,
      formErrors.tooShort(options.name, MIN_ENTITY_LENGTH),
    )
    .refine(
      (str) =>
        options.skipMaxBytesCheck ||
        getUtf8BytesLength(options.buildNameForByteValidation?.(str) ?? str) <=
          (options.maxBytes ?? getResourceMaxSegmentBytes()),
      formErrors.tooLong(options.name),
    )
    .refine(
      (str) =>
        options.skipCheckRestrictedSymbols || !specialCharactersRegex.test(str),
      formErrors.hasSpecialCharacters(options.name),
    )
    .refine(
      (str) => !options.checkDotsInTheEnd || !doesHaveDotsInTheEnd(str),
      formErrors.noDotInTheEnd(options.name),
    )
    .refine(
      (str) => !options.checkDotsInTheStart || !doesHaveDotsInTheStart(str),
      formErrors.noDotInTheStart(options.name),
    );

export const EntityLocalesSchema = zodValidation.array(
  zodValidation.object({
    locale: zodValidation.string(),
    name: getEntityNameSchema({
      name: 'Name',
      checkDotsInTheEnd: true,
      skipMaxBytesCheck: true,
    }),
    description: zodValidation.string(),
  }),
);

export const MarketplaceEntityBaseSchema = zodValidation
  .object({
    name: getEntityNameSchema({
      name: 'Name',
      checkDotsInTheEnd: true,
      skipMaxBytesCheck: true,
    }),
    version: zodValidation
      .string()
      .nonempty(versionsErrors.required)
      .refine(isVersionValid, versionsErrors.notValid)
      .refine(isVersionPartSizeValid, versionsErrors.tooLongPart),
    description: zodValidation.string(),
    iconUrl: zodValidation.string(),
    topics: zodValidation.array(zodValidation.string()),
    locales: EntityLocalesSchema,
  })
  .superRefine((data, ctx) => {
    const apiKey = getMarketplaceEntityApiKey({
      name: data.name,
      version: data.version,
    });
    const maxSegmentBytes = getResourceMaxSegmentBytes();

    if (getUtf8BytesLength(apiKey) > maxSegmentBytes) {
      ctx.addIssue({
        code: 'custom',
        path: ['name'],
        message: formErrors.tooLong('Name'),
      });
    }
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
