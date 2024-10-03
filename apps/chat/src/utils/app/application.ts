import {
  ApplicationInfo,
  CustomApplicationModel,
} from '@/src/types/applications';
import { EntityType, PartialBy } from '@/src/types/common';
import { DialAIEntityFeatures } from '@/src/types/models';

import { ApiUtils, getApplicationApiKey } from '../server/api';
import { constructPath } from './file';
import { getFolderIdFromEntityId } from './folders';
import { getApplicationRootId } from './id';

export const getGeneratedApplicationId = (
  application: Omit<ApplicationInfo, 'id'>,
): string => {
  return constructPath(
    getApplicationRootId(),
    getApplicationApiKey(application),
  );
};

export const regenerateApplicationId = <T extends ApplicationInfo>(
  application: PartialBy<T, 'id'>,
): T => {
  const newId = getGeneratedApplicationId(application);
  if (!application.id || newId !== application.id) {
    return {
      ...application,
      id: newId,
    } as T;
  }
  return application as T;
};

export interface ApiApplicationModel {
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
  description_keywords?: string[];
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
  description_keywords: applicationData.topics
});

interface BaseApplicationDetailsResponse {
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

export interface ApplicationDetailsResponse
  extends BaseApplicationDetailsResponse {
  name: string;
}

interface PublicApplicationDetailsResponse
  extends BaseApplicationDetailsResponse {
  application: string;
}

export const convertApplicationFromApi = (
  application: ApplicationDetailsResponse | PublicApplicationDetailsResponse,
): CustomApplicationModel => {
  const id = ApiUtils.decodeApiUrl(
    'application' in application ? application.application : application.name,
  );
  return {
    ...application,
    isDefault: false,
    type: EntityType.Application,
    id,
    inputAttachmentTypes: application.input_attachment_types,
    iconUrl: application.icon_url,
    maxInputAttachments: application.max_input_attachments,
    version: application.display_version,
    name: application.display_name,
    completionUrl: application.endpoint,
    folderId: getFolderIdFromEntityId(id),
  };
};
