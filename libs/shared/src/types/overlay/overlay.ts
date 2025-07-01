import { type OverlayEvents } from '../../constants';
import { DialLibRequest, Styles } from '../common';
import { Feature } from '../features';

export type OverlayRequest = DialLibRequest;

export interface ChatOverlayOptions {
  domain: string;
  hostDomain: string;

  theme?: string;
  modelId?: string;
  overlayConversationId?: string;
  newConversationsFolderId?: string;

  enabledFeatures?: Feature[] | string;

  requestTimeout?: number;

  loaderStyles?: Styles;
  loaderClass?: string;
  loaderInnerHTML?: string;
  loaderHideEvent?: OverlayEvents;

  messageButtons?: MessageButtons[];

  signInOptions?: OverlaySignInOptions;
  signInInSameWindow?: boolean;
}

interface OverlaySignInOptions {
  autoSignIn: boolean;
  signInProvider?: string;
  signInInNewWindow?: boolean;
}

export interface MessageButton {
  buttonKey: string; // Unique key which will be exposed to host on click
  events: (keyof WindowEventMap)[];
  title?: string;
  tooltip?: string;
  iconSvg?: string;
  skipDefaultStyles?: boolean;
  styles?: Styles;
  hoverStyles?: Styles;
  focusStyles?: Styles;
  disabledStyles?: Styles;
  disabled?: boolean;
}

export interface MessageButtons {
  messageIndex: number;
  buttons: MessageButton[];
}
