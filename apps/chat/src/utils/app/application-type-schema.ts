import {
  ApiApplicationTypeSchema,
  ApplicationTypeSchema,
} from '@/src/types/application-type-schema';

export const convertApplicationTypeSchemaFromApi = (
  schema: ApiApplicationTypeSchema,
): ApplicationTypeSchema => {
  return {
    id: schema.$id,
    displayName: schema['dial:applicationTypeDisplayName'],
    editorUrl: schema['dial:applicationTypeEditorUrl'],
    viewerUrl: schema['dial:applicationTypeViewerUrl'],
  };
};

export function encode(text: string) {
  const cleanedLink = text.replace(/^https?:\/\//, '');
  return encodeURIComponent(cleanedLink);
}

export function decode(encryptedText: string) {
  return decodeURIComponent(encryptedText);
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
