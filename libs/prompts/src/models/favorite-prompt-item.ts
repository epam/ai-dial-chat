/** A single favorited prompt as shown in {@link FavoritePromptsPanelProps}. */
export interface FavoritePromptItem {
  /** Stable identifier for the prompt. */
  id: string;
  /** Display name. */
  name: string;
  /** Short description shown in a tooltip on hover. Omitted when empty. */
  description?: string;
  /** Full prompt body, including any `{{param}}` tokens. */
  content: string;
}
