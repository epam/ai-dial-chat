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
