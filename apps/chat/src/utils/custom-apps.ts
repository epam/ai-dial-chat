import type { CustomAppFormData } from '../types/custom-apps';

export const MIME_TYPE_REGEX =
  /^([a-zA-Z0-9!*\-.+]+|\*)\/([a-zA-Z0-9!*\-.+]+|\*)$/;

export const DEFAULT_CUSTOM_APP_SETTINGS_FORM: CustomAppFormData = {
  completionUrl: '',
  featuresData: '',
  inputAttachmentTypes: [],
  maxInputAttachments: '',
};

export const isValidAbsoluteUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!/^https?:\/\//.test(trimmed)) return false;
  try {
    return Boolean(new URL(trimmed));
  } catch {
    return false;
  }
};

export const isValidFeaturesData = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      return false;
    const obj = parsed as Record<string, unknown>;
    return 'rate_endpoint' in obj || 'configuration_endpoint' in obj;
  } catch {
    return false;
  }
};
