import type {
  CustomAppFormData,
  CustomAppGeneralFormData,
} from '../models/custom-apps';

export const DEFAULT_CUSTOM_APP_GENERAL_FORM: CustomAppGeneralFormData = {
  name: '',
  version: '0.0.1',
  iconUrl: '',
  description: '',
  topics: [],
  otherLocales: [],
};

export const MIME_TYPE_REGEX =
  /^([a-zA-Z0-9!*\-.+]+|\*)\/([a-zA-Z0-9!*\-.+]+|\*)$/;

export const DEFAULT_CUSTOM_APP_SETTINGS_FORM: CustomAppFormData = {
  completionUrl: '',
  featuresData: '',
  inputAttachmentTypes: [],
  maxInputAttachments: '',
};
