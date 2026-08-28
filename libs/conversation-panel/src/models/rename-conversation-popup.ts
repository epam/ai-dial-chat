import type { CSSProperties } from 'react';

/** Labels for every user-visible string in `RenameConversationPopup`. */
export interface RenameConversationPopupLabels {
  /** Popup dialog heading. */
  popupTitle: string;
  /** Placeholder text for the name input. */
  inputPlaceholder: string;
  /** Accessible name and tooltip for the AI-generation trigger button. */
  renameWithAiLabel: string;
  /** Error shown when the AI name generation request fails. */
  renameWithAiError: string;
  /** Error shown when the trimmed name's UTF-8 byte length exceeds 255. */
  nameTooLongError: string;
  /** Label for the save/confirm button. */
  saveLabel: string;
  /** Label for the cancel button. */
  cancelLabel: string;
}

/** Style overrides for `RenameConversationPopup` content. */
export interface RenameConversationPopupStyles {
  /** Extra class name(s) merged onto the popup body wrapper. */
  bodyClassName?: string;
  /** Arbitrary CSS custom properties inherited by the popup content. */
  cssVars?: CSSProperties;
}

/** Props accepted by `RenameConversationPopup`. */
export interface RenameConversationPopupProps {
  /** Whether the popup is visible. */
  isOpen: boolean;
  /** The conversation's current name, pre-filled into the input on open. */
  currentTitle: string;
  /** While `true`, the input/buttons are replaced by a loading indicator. */
  isSaving: boolean;
  /** API-level error message, or `null` when none. */
  error: string | null;
  /** Called with the trimmed, sanitized new name when the user confirms. */
  onSave: (newTitle: string) => void;
  /** Called when the user cancels or closes the popup. */
  onCancel: () => void;
  /** Called to request an AI-generated name; must resolve with the generated string. */
  onGenerateWithAi: () => Promise<string>;
  /** User-visible string labels. */
  labels: RenameConversationPopupLabels;
  /** Class and CSS-variable overrides for the popup content. */
  styles?: RenameConversationPopupStyles;
}
