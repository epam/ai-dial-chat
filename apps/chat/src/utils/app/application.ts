import {
  ApplicationInfo,
  CustomApplicationModel,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { DialAIEntityFeatures } from '@/src/types/models';

import { ApiUtils, getApplicationApiKey } from '../server/api';
import { constructPath } from './file';
import { getFolderIdFromEntityId } from './folders';
import { getApplicationRootId } from './id';

export const getGeneratedApplicationId = <T extends ApplicationInfo>(
  application: Omit<T, 'folderId' | 'id' | 'reference'>,
): string => {
  return constructPath(
    getApplicationRootId(),
    getApplicationApiKey(application),
  );
};

interface ApiApplicationModel {
  endpoint: string;
  display_name: string;
  display_version: string;
  icon_url: string;
  description?: string;
  features?: DialAIEntityFeatures;
  input_attachment_types?: string[];
  max_input_attachments?: number;
  defaults?: Record<string, unknown>;
  url?: string;
  reference?: string;
}

export const convertApplicationToApi = (
  applicationData: Omit<CustomApplicationModel, 'id'>,
): ApiApplicationModel => ({
  endpoint: applicationData.completionUrl,
  display_name: applicationData.name,
  display_version: applicationData.version,
  icon_url: applicationData.iconUrl ?? '',
  description: applicationData.description,
  features: applicationData.features,
  input_attachment_types: applicationData.inputAttachmentTypes,
  max_input_attachments: applicationData.maxInputAttachments,
  defaults: {},
  reference: applicationData.reference || undefined,
});

export interface ApplicationDetailsResponse {
  name: string;
  endpoint: string;
  display_name: string;
  display_version: string;
  icon_url: string;
  description: string;
  forward_auth_token: boolean;
  input_attachment_types: string[];
  max_input_attachments: number;
  features: Record<string, string>;
  defaults: Record<string, unknown>;
  reference: string;
}

export const convertApplicationFromApi = (
  application: ApplicationDetailsResponse,
): CustomApplicationModel => ({
  ...application,
  isDefault: false,
  type: EntityType.Application,
  id: ApiUtils.decodeApiUrl(application.name),
  inputAttachmentTypes: application.input_attachment_types,
  iconUrl: application.icon_url,
  maxInputAttachments: application.max_input_attachments,
  version: application.display_version,
  name: application.display_name,
  completionUrl: application.endpoint,
  folderId: getFolderIdFromEntityId(application.name),
});
