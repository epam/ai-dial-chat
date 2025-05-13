import {
  ApiApplicationTypeSchema,
  ApplicationTypeSchema,
  ApplicationTypeSchemaProperties,
} from '@/src/types/application-type-schema';

export const convertApplicationTypeSchemaFromApi = (
  schema: ApiApplicationTypeSchema,
): ApplicationTypeSchema => {
  return {
    id: schema.$id,
    displayName:
      schema[ApplicationTypeSchemaProperties.applicationTypeDisplayName],
    editorUrl: schema[ApplicationTypeSchemaProperties.applicationTypeEditorUrl],
    viewerUrl: schema[ApplicationTypeSchemaProperties.applicationTypeViewerUrl],
  };
};

export const cleanSchemaId = (schemaId: string) =>
  schemaId.replace(/^https?:\/\//, '');

export function encodeSlug(text: string) {
  const cleanedLink = cleanSchemaId(text);
  return encodeURIComponent(cleanedLink);
}

export function pluralizeDisplayName(displayName: string): string {
  if (displayName.match(/[^aeiou]y$/i)) {
    return `My ${displayName.slice(0, -1)}ies`;
  }
  if (displayName.match(/(s|sh|ch|x|z)$/i)) {
    return `My ${displayName}es`;
  }
  return `My ${displayName}s`;
}
