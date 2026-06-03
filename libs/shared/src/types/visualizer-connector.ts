import { DialLibRequest, Styles } from './common';

export interface VisualizerConnectorOptions {
  domain: string;
  hostDomain: string;
  visualizerName: string;
  loaderStyles?: Styles;
  loaderClass?: string;
  loaderInnerHTML?: string;

  requestTimeout?: number;
}

export type VisualizerConnectorRequest = DialLibRequest;

export interface CustomVisualizerDataLayout {
  width: number;
  height: number;
  mobileHeight?: number;
  themeId?: string;
  logInHint?: string;
  providerId?: string;
  accessToken?: string;
  currentLocale?: string;
  dir?: 'ltr' | 'rtl';
}
export interface CustomVisualizerData {
  layout: CustomVisualizerDataLayout;
}

export interface AttachmentData {
  mimeType: string;
  visualizerData: CustomVisualizerData;
}

export interface AttachmentItem {
  url: string;
  mimeType: string;
  visualizerData: CustomVisualizerData;
}

export interface GroupedAttachmentsData {
  attachments: AttachmentItem[];
  layout: CustomVisualizerDataLayout;
}
