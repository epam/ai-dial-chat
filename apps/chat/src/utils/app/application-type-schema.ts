import {
  ApiApplicationTypeSchema,
  ApiDetailedApplicationTypeSchema,
  ApplicationTypeSchema,
  ApplicationTypeSchemaProperties,
} from '@/src/types/application-type-schema';

import { JSONSchema7, JSONSchema7Object } from 'json-schema';

export const convertApplicationTypeSchemaFromApi = (
  schema: ApiApplicationTypeSchema,
): ApplicationTypeSchema => {
  return {
    id: schema.$id,
    displayName:
      schema[ApplicationTypeSchemaProperties.applicationTypeDisplayName],
    editorUrl: schema[ApplicationTypeSchemaProperties.applicationTypeEditorUrl],
    viewerUrl: schema[ApplicationTypeSchemaProperties.applicationTypeViewerUrl],
    iconUrl: schema[ApplicationTypeSchemaProperties.applicationTypeIconUrl],
    applicationTypePlaybackSupport:
      schema[ApplicationTypeSchemaProperties.applicationTypePlaybackSupport],
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

export const getDefaultSchemaModel = (
  schema?: ApiDetailedApplicationTypeSchema,
) => {
  if (!schema) return undefined;

  const orchestrator = schema.properties?.orchestrator as
    | JSONSchema7
    | undefined;
  const deploymentDefault = (
    orchestrator?.properties?.deployment as JSONSchema7 | undefined
  )?.default as JSONSchema7Object | undefined;

  return deploymentDefault?.deployment_id as string;
};
