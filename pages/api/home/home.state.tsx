import { Feature } from '@/types/features';

export interface HomeInitialState {
  isIframe: boolean;
  footerHtmlMessage: string;

  enabledFeatures: Set<Feature>;
}

export const initialState: HomeInitialState = {
  isIframe: false,
  footerHtmlMessage: '',

  enabledFeatures: new Set([]),
};
