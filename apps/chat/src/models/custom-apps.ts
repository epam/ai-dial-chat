export type { DeploymentGeneralFormData as CustomAppGeneralFormData } from '@epam/ai-dial-toolset-editor';

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
