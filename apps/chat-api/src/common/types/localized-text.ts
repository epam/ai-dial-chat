/**
 * DIAL Core's shape for a user-facing text field: either a plain string (no
 * localized variants) or a map of locale code to translated value.
 */
export type LocalizedText = string | Record<string, string>;

/** Swagger `oneOf` schema matching {@link LocalizedText}, for `@ApiProperty`/`@ApiPropertyOptional`. */
export const LOCALIZED_TEXT_SCHEMA = {
  oneOf: [
    { type: 'string' as const },
    {
      type: 'object' as const,
      additionalProperties: { type: 'string' as const },
    },
  ],
};
