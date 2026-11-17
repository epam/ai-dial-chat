/** Tabs of the prompt-parameters popup shown on mobile viewports. */
export enum PromptParametersPopupTab {
  Parameters = 'parameters',
  Details = 'details',
}

/** Returns `true` when `value` is the id of a `PromptParametersPopupTab` member. */
export const isPromptParametersPopupTab = (
  value: string,
): value is PromptParametersPopupTab =>
  Object.values<string>(PromptParametersPopupTab).includes(value);
