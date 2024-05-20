import { DialLibRequest, Styles } from './common';
import { Feature } from './features';

export type OverlayRequest = DialLibRequest;

export interface ChatOverlayOptions {
  domain: string;
  hostDomain: string;

  theme?: string;
  modelId?: string;

  enabledFeatures?: Feature[] | string;

  requestTimeout?: number;

  loaderStyles?: Styles;
  loaderClass?: string;
  loaderInnerHTML?: string;

  signInOptions?: OverlaySignInOptions;
}

interface OverlaySignInOptions {
  autoSignIn: boolean;
  signInProvider?: string;
}
