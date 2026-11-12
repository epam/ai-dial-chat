import type { FolderDestinationTreeStyles } from '@epam/ai-dial-folder-destination-panel';
import type { CSSProperties } from 'react';
import type { PublishAccessRulesStyles } from './publish-access-rules-styles';

/** Color overrides for the publish panel body. */
export interface PublishPanelColors {
  /** Summary row border color. Defaults to `--stroke-tertiary`. */
  summaryBorder?: string;
  /** Summary row background color. Defaults to `--bg-layer-sunken`. */
  summaryBackground?: string;
  /** Default summary title text color. Defaults to `--text-primary`. */
  summaryTitleText?: string;
  /** Section heading text color. Defaults to `--text-primary`. */
  headingText?: string;
  /** Destination folder path text color. Defaults to `--text-secondary`. */
  destinationText?: string;
}

/** Style overrides for the publish panel body and its nested components. */
export interface PublishPanelStyles {
  /** Color overrides for the panel body. */
  colors?: PublishPanelColors;
  /** Style overrides forwarded to the destination folder tree. */
  folderTree?: FolderDestinationTreeStyles;
  /** Style overrides forwarded to the access-rules section. */
  accessRules?: PublishAccessRulesStyles;
  /** Additional CSS custom properties applied to the panel body root. */
  cssVars?: CSSProperties;
}
