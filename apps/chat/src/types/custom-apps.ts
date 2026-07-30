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
