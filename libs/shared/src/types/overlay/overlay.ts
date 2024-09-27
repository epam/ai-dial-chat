import { DialLibRequest, Styles } from '../common';
import { Feature } from '../features';

export type OverlayRequest = DialLibRequest;

export interface ChatOverlayOptions {
  domain: string;
  hostDomain: string;

  theme?: string;
  modelId?: string;
  overlayConversationId?: string;

  enabledFeatures?: Feature[] | string;

  requestTimeout?: number;

  loaderStyles?: Styles;
  loaderClass?: string;
  loaderInnerHTML?: string;

  signInOptions?: OverlaySignInOptions;
  signInInSameWindow?: boolean;
}

interface OverlaySignInOptions {
  autoSignIn: boolean;
  signInProvider?: string;
}
