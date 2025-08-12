import { type OverlayEvents } from '../../constants';
import { DialLibRequest, Styles } from '../common';
import { Feature, FeatureData } from '../features';

export type OverlayRequest = DialLibRequest;

export interface ChatOverlayOptions {
  domain: string;
  hostDomain: string;

  theme?: string;
  modelId?: string;
  overlayConversationId?: string;
  newConversationsFolderId?: string;

  enabledFeatures?: Feature[] | string;
  enabledFeaturesData?: Partial<Record<Feature | string, FeatureData>>;

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

export enum MessageButtonPlacement {
  PREPEND_DEFAULT_BUTTONS = 'PREPEND_DEFAULT_BUTTONS', // Buttons to show before default buttons
  CONTENT_APPEND = 'CONTENT_APPEND', // (Default) Buttons to show in separate block after all content, but before default message buttons
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
  placement?: MessageButtonPlacement;
  disabled?: boolean;
}

export interface MessageButtons {
  messageIndex: number;
  buttons: MessageButton[];
}
