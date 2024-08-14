import {
  ApplicationDetailsResponse,
  ApplicationInfo,
  CreateApplicationModel,
  CustomApplicationModel,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';

import { getApplicationApiKey } from '../server/api';
import { constructPath } from './file';
import { getApplicationRootId } from './id';

export const getGeneratedApplicationId = <T extends ApplicationInfo>(
  application: Omit<T, 'folderId' | 'id'>,
): string => {
  return constructPath(
    getApplicationRootId(),
    getApplicationApiKey(application),
  );
};

export const convertApplicationToApi = (
  applicationData: Omit<CustomApplicationModel, 'id' | 'reference'>,
): CreateApplicationModel => ({
  endpoint: applicationData.completionUrl,
  display_name: applicationData.name,
  display_version: applicationData.version,
  icon_url: applicationData.iconUrl ?? '',
  description: applicationData.description,
  features: applicationData.features,
  input_attachment_types: applicationData.inputAttachmentTypes,
  max_input_attachments: applicationData.maxInputAttachments,
  defaults: {},
});

export const convertApplicationFromApi = (
  application: ApplicationDetailsResponse,
): CustomApplicationModel => ({
  ...application,
  isDefault: false,
  type: EntityType.Application,
  id: application.name,
  inputAttachmentTypes: application.input_attachment_types,
  iconUrl: application.icon_url,
  maxInputAttachments: application.max_input_attachments,
  version: application.display_version,
  name: application.display_name,
  completionUrl: application.endpoint,
});
