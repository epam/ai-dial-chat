import { Styles } from './overlay';

export interface VisualizerOptions {
  domain: string;
  hostDomain: string;
  visualizerName: string;
  loaderStyles?: Styles;
  loaderClass?: string;
  loaderInnerHTML?: string;

  requestTimeout?: number;
}

export interface VisualizerConnectorRequest {
  type: string;
  requestId: string;
  payload?: unknown;
}
