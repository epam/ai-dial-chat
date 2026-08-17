import type { CSSProperties } from 'react';
import type { PublicationRule } from './publish';

/** Text overrides for the access-rule editor. */
export interface PublishAccessRuleEditorLabels {
  /** Source picker label. Defaults to `'Source'`. */
  sourceLabel?: string;
  /** Source picker placeholder. Defaults to `'Select...'`. */
  sourcePlaceholder?: string;
  /** Function picker label. Defaults to `'Function'`. */
  functionLabel?: string;
  /** EQUAL option label. Defaults to `'Equal'`. */
  equalOptionLabel?: string;
  /** CONTAIN option label. Defaults to `'Contain'`. */
  containOptionLabel?: string;
  /** REGEX option label. Defaults to `'Regex'`. */
  regexOptionLabel?: string;
  /** Targets field label. Defaults to `'Targets'`. */
  targetsLabel?: string;
  /** Targets field placeholder. Defaults to `'Add a target'`. */
  targetsPlaceholder?: string;
  /** Targets field hint. Defaults to `'Press Enter or comma to add a target.'`. */
  targetsHintLabel?: string;
  /** Pattern field label. Defaults to `'Pattern'`. */
  patternLabel?: string;
  /** Pattern field placeholder. Defaults to `'Enter a regular expression'`. */
  patternPlaceholder?: string;
  /** Invalid-regex message. Defaults to `'Enter a valid regular expression.'`. */
  invalidRegexError?: string;
  /** Required picker message. Defaults to `'This field is required.'`. */
  requiredFieldError?: string;
  /** Required targets message. Defaults to `'Add at least one target.'`. */
  targetsRequiredError?: string;
  /** Save action label. Defaults to `'Save'`. */
  saveLabel?: string;
  /** Cancel action label. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /** Dialog accessible label. Defaults to `'Add access rule'`. */
  dialogAriaLabel?: string;
}

/** Color overrides for the access-rule editor. */
export interface PublishAccessRuleEditorColors {
  /** Full-screen mobile background. Defaults to `--bg-layer-1`. */
  mobileBackground?: string;
  /** Desktop panel background. Defaults to `--bg-layer-base`. */
  background?: string;
  /** Validation error text color. Defaults to `--text-error`. */
  errorText?: string;
  /** Picker border color. Defaults to `--stroke-tertiary`. */
  selectBorder?: string;
  /** Picker hover border color. Defaults to `--stroke-secondary`. */
  selectBorderHover?: string;
  /** Open picker border color. Defaults to `--stroke-info`. */
  selectBorderOpen?: string;
  /** Focused picker border color. Defaults to `--stroke-info`. */
  selectBorderFocus?: string;
}

/** Style overrides for the access-rule editor. */
export interface PublishAccessRuleEditorStyles {
  /** Color overrides. */
  colors?: PublishAccessRuleEditorColors;
  /** Additional CSS custom properties applied to the editor root. */
  cssVars?: CSSProperties;
}

/** Props for the access-rule editor. */
export interface PublishAccessRuleEditorProps {
  /** Options offered in the source picker. */
  sourceOptions: string[];
  /** Called with the completed rule. */
  onSave: (rule: PublicationRule) => void;
  /** Called when editing is cancelled. */
  onCancel: () => void;
  /** Disables every control. Defaults to `false`. */
  disabled?: boolean;
  /** Maximum target count. Defaults to `20`. */
  maxTargets?: number;
  /** Text overrides. */
  labels?: PublishAccessRuleEditorLabels;
  /** Typography class for validation errors. Defaults to `'dial-small-text'`. */
  errorClassName?: string;
  /** Style overrides. */
  styles?: PublishAccessRuleEditorStyles;
}
