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

export function encrypt(text: string) {
  const cleanedLink = text.replace(/^https?:\/\//, '');
  return encodeURIComponent(cleanedLink);
}

export function decrypt(encryptedText: string) {
  return decodeURIComponent(encryptedText);
}
