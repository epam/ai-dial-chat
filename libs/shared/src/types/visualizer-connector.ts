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

export interface CustomVisualizerDataLayout extends Record<string, unknown> {
  width: number;
  height: number;
}
export interface CustomVisualizerData extends Record<string, unknown> {
  layout: CustomVisualizerDataLayout;
}
export interface AttachmentData {
  mimeType: string;
  visualizerData: CustomVisualizerData;
}
