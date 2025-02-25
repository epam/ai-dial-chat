import { UploadStatus } from '@epam/ai-dial-shared';
import { JSONSchema7 } from 'json-schema';

export interface ApplicationTypesSchemasState {
  schemasLoading: UploadStatus;
  schemas: ApplicationTypeSchema[];
  detailedApplicationTypeSchema: ApiDetailedApplicationTypeSchema | null;
  detailedApplicationTypeSchemaLoading: UploadStatus;
}

export interface ApiApplicationTypeSchema {
  $id: string;
  'dial:applicationTypeDisplayName': string;
  'dial:applicationTypeEditorUrl': string;
  'dial:applicationTypeViewerUrl'?: string;
}

export interface ApplicationTypeSchema {
  id: string;
  displayName: string;
  editorUrl: string;
  viewerUrl?: string;
}

export interface ApiDetailedApplicationTypeSchema extends JSONSchema7 {
  $id: string;
  'dial:applicationTypeDisplayName': string;
  'dial:applicationTypeEditorUrl': string;
  'dial:applicationTypeViewerUrl'?: string;
}
