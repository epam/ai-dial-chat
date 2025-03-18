import { JSONSchema7 } from 'json-schema';

export enum ApplicationTypeSchemaProperties {
  applicationTypeDisplayName = 'dial:applicationTypeDisplayName',
  applicationTypeEditorUrl = 'dial:applicationTypeEditorUrl',
  applicationTypeViewerUrl = 'dial:applicationTypeViewerUrl',
}

export interface ApiApplicationTypeSchema {
  $id: string;
  [ApplicationTypeSchemaProperties.applicationTypeDisplayName]: string;
  [ApplicationTypeSchemaProperties.applicationTypeEditorUrl]?: string;
  [ApplicationTypeSchemaProperties.applicationTypeViewerUrl]?: string;
}

export interface ApplicationTypeSchema {
  id: string;
  displayName: string;
  editorUrl?: string;
  viewerUrl?: string;
}

export interface ApiDetailedApplicationTypeSchema extends JSONSchema7 {
  $id: string;
  [ApplicationTypeSchemaProperties.applicationTypeDisplayName]: string;
  [ApplicationTypeSchemaProperties.applicationTypeEditorUrl]?: string;
  [ApplicationTypeSchemaProperties.applicationTypeViewerUrl]?: string;
}
