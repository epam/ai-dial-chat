import { JSONSchema7 } from 'json-schema';

export enum ApplicationTypeSchemaProperties {
  applicationTypeDisplayName = 'dial:applicationTypeDisplayName',
  applicationTypeEditorUrl = 'dial:applicationTypeEditorUrl',
  applicationTypeViewerUrl = 'dial:applicationTypeViewerUrl',
  applicationTypeIconUrl = 'dial:applicationTypeIconUrl',
  applicationTypePlaybackSupport = 'dial:applicationTypePlaybackSupport',
}

export interface ApiApplicationTypeSchema {
  $id: string;
  [ApplicationTypeSchemaProperties.applicationTypeDisplayName]: string;
  [ApplicationTypeSchemaProperties.applicationTypeEditorUrl]?: string;
  [ApplicationTypeSchemaProperties.applicationTypeViewerUrl]?: string;
  [ApplicationTypeSchemaProperties.applicationTypeIconUrl]?: string;
  [ApplicationTypeSchemaProperties.applicationTypePlaybackSupport]?: boolean;
}

export interface ApplicationTypeSchema {
  id: string;
  displayName: string;
  editorUrl?: string;
  viewerUrl?: string;
  iconUrl?: string;
  applicationTypePlaybackSupport?: boolean;
}

export interface ApiDetailedApplicationTypeSchema extends JSONSchema7 {
  $id: string;
  [ApplicationTypeSchemaProperties.applicationTypeDisplayName]: string;
  [ApplicationTypeSchemaProperties.applicationTypeEditorUrl]?: string;
  [ApplicationTypeSchemaProperties.applicationTypeViewerUrl]?: string;
  [ApplicationTypeSchemaProperties.applicationTypeIconUrl]?: string;
}
