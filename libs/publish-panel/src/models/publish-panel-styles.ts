import type { CSSProperties } from 'react';
import type { PublishAccessRulesStyles } from './publish-access-rules-styles';
import type { PublishFoldersTreeStyles } from './publish-folders-tree';

/** Color overrides for the publish panel body. */
export interface PublishPanelColors {
  /** Summary row border color. Defaults to `--stroke-tertiary`. */
  summaryBorder?: string;
  /** Summary row background color. Defaults to `--bg-layer-sunken`. */
  summaryBackground?: string;
  /** Version tag border color. Defaults to `--stroke-tertiary`. */
  summaryVersionTagBorder?: string;
  /** Version tag background color. Defaults to `--bg-accent-primary-alpha`. */
  summaryVersionTagBackground?: string;
  /** Version tag text color. Defaults to `--text-accent`. */
  summaryVersionTagText?: string;
  /** Default summary title text color. Defaults to `--text-primary`. */
  summaryTitleText?: string;
  /** Section heading text color. Defaults to `--text-primary`. */
  headingText?: string;
}

/** Style overrides for the publish panel body and its nested components. */
export interface PublishPanelStyles {
  /** Color overrides for the panel body. */
  colors?: PublishPanelColors;
  /** Style overrides forwarded to the destination folder tree. */
  folderTree?: PublishFoldersTreeStyles;
  /** Style overrides forwarded to the access-rules section. */
  accessRules?: PublishAccessRulesStyles;
  /** Additional CSS custom properties applied to the panel body root. */
  cssVars?: CSSProperties;
}
