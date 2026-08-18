import type { CSSProperties } from 'react';
import type { PublishAccessRuleEditorStyles } from './publish-access-rule-editor';

/** Color overrides for the access-rules section. */
export interface PublishAccessRulesColors {
  /** Rule row background. Defaults to `--bg-layer-base`. */
  ruleBackground?: string;
  /** Section heading text color. Defaults to `--text-primary`. */
  headingText?: string;
  /** Hint text color. Defaults to `--text-primary`. */
  hintText?: string;
  /** Loading message text color. Defaults to `--text-primary`. */
  loadingText?: string;
  /** Rule chip text color. Defaults to `--text-primary`. */
  ruleText?: string;
}

/** Style overrides for the access-rules section and its editor. */
export interface PublishAccessRulesStyles {
  /** Color overrides for the section. */
  colors?: PublishAccessRulesColors;
  /** Style overrides forwarded to the nested rule editor. */
  editor?: PublishAccessRuleEditorStyles;
  /** Additional CSS custom properties applied to the section root. */
  cssVars?: CSSProperties;
}
