import {
  ApiApplicationTypeSchema,
  ApplicationTypeSchema,
} from '@/src/types/application-type-chema';

export const convertApplicationTypeSchemaFromApi = (
  schema: ApiApplicationTypeSchema,
): ApplicationTypeSchema => {
  return {
    id: schema.$id,
    displayName: schema['dial:applicationTypeDisplayName'],
    editorUrl: schema['dial:applicationTypeEditorUrl'],
  };
};

export function encrypt(text: string, key = 'application-schema-id') {
  return Buffer.from(
    text
      .split('')
      .map((char, i) => char.charCodeAt(0) ^ key.charCodeAt(i % key.length)),
  ).toString('hex');
}

export function decrypt(encryptedText: string, key = 'application-schema-id') {
  return Buffer.from(encryptedText, 'hex')
    .map((char, i) => char ^ key.charCodeAt(i % key.length))
    .toString();
}
