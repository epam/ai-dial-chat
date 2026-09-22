/**
 * Eager component entry used by the root export dynamic import. Keeping it a
 * separate build entry preserves the popup/catalog chunk in published packages.
 * Hosts may use this subpath to manage loading themselves.
 */
export { PromptParametersPopup } from '../components/PromptParametersPopup/PromptParametersPopup';
export type {
  PromptParametersPopupColors,
  PromptParametersPopupLabels,
  PromptParametersPopupProps,
} from '../models/prompt-parameters-popup-props';
