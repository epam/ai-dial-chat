import {
  ApiApplicationResponseDefault,
  CustomApplicationModel,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { DialAIEntityFeatures } from '@/src/types/models';

import { ApplicationGeneralInfoFormData } from '../GeneralInfoView/form';

import { isObject } from 'lodash-es';

export interface CustomApplicationFormData
  extends ApplicationGeneralInfoFormData {
  inputAttachmentTypes: string[];
  maxInputAttachments: string;
  completionUrl: string;
  features: string | null;
  id: string;
  reference: string;
}

const safeStringify = (
  featureData: DialAIEntityFeatures | Record<string, string> | undefined,
) => {
  if (
    !featureData ||
    (isObject(featureData) && !Object.keys(featureData).length)
  ) {
    return '';
  }

  return JSON.stringify(featureData, null, 2);
};

export const getCustomApplicationDefaultValues = ({
  app,
}: {
  app: ApiApplicationResponseDefault;
}): CustomApplicationFormData => ({
  name: app.display_name,
  id: app.name,
  description: app.description,
  version: app.display_version,
  iconUrl: app.icon_url ?? '',
  topics: app.description_keywords ?? [],
  inputAttachmentTypes: app.input_attachment_types ?? [],
  maxInputAttachments: String(app.max_input_attachments ?? ''),
  completionUrl: app.endpoint ?? '',
  features: safeStringify(app.features),
  reference: app.reference,
});

export const getCustomApplicationData = (
  formData: CustomApplicationFormData,
): Omit<CustomApplicationModel, 'id' | 'reference'> => {
  const preparedData: Omit<CustomApplicationModel, 'id' | 'reference'> = {
    name: formData.name,
    type: EntityType.Application,
    isDefault: false,
    folderId: '',
    topics: formData.topics,
    description: formData.description.trim(),
    completionUrl: formData.completionUrl,
    version: formData.version,
    iconUrl: formData.iconUrl,
    inputAttachmentTypes: formData.inputAttachmentTypes,
    maxInputAttachments: formData.maxInputAttachments
      ? Number(formData.maxInputAttachments)
      : undefined,
    features: formData.features ? JSON.parse(formData.features) : null,
  };
  return preparedData;
};
