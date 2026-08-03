export interface CustomAppGeneralFormData {
  name: string;
  version: string;
  iconUrl: string;
  description: string;
  topics: string[];
  intro: string;
}

export interface CustomAppFormData {
  completionUrl: string;
  featuresData: string;
  inputAttachmentTypes: string[];
  maxInputAttachments: number | '';
}

export interface CustomAppFormErrors {
  completionUrl?: string;
  inputAttachmentTypes?: string;
}
