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
  themeId?: string;
  logInHint?: string;
  providerId?: string;
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
