import { Feature } from './features';

export interface OverlayRequest {
  type: string;
  requestId: string;
  payload?: unknown;
}

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

export type Styles = { [property in keyof CSSStyleDeclaration]?: string };
