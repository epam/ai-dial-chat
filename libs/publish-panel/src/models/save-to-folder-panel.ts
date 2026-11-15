import type { CSSProperties, Ref, RefObject } from 'react';
import type { PublishAccessRulesLabels } from '../components/PublishAccessRules/PublishAccessRules';
import type {
  SaveToFolderView,
  SaveVersionMode,
} from '../types/save-to-folder';
import type {
  FolderDestination,
  FolderDestinationRoot,
} from './folder-destination';
import type { PublicationRule, PublishResourceSummary } from './publish';
import type { PublishAccessRulesStyles } from './publish-access-rules-styles';
import type { PublishFoldersTreeStyles } from './publish-folders-tree';
import type { VersionHistorySectionProps } from './version-history';

/** Text overrides for the body of the save-to-folder panel. */
export interface SaveToFolderPanelLabels {
  /** Heading of the destination section. Defaults to `'Save to folder'`. */
  saveToFolderHeading?: string;
  /** Label of the action that opens the folder tree. Defaults to `'Change'`. */
  changeFolderLabel?: string;
  /** Accessible name of the destination path. Defaults to `'Destination folder'`. */
  destinationAriaLabel?: string;
  /** Heading of the version section. Defaults to `'Version'`. */
  versionHeading?: string;
  /** Label of the keep-version option; `{version}` is replaced. Defaults to `'Keep version {version}'`. */
  keepVersionLabel?: string;
  /** Label of the new-version option. Defaults to `'Save as new version'`. */
  saveAsNewVersionLabel?: string;
  /** Label of the new version input. Defaults to `'Version'`. */
  newVersionLabel?: string;
  /** Placeholder of the new version input. Defaults to `'Enter new version'`. */
  newVersionPlaceholder?: string;
  /** Placeholder and accessible name of the folder search. Defaults to `'Search folders'`. */
  searchPlaceholder?: string;
  /** Accessible name of the search clear button. Defaults to `'Clear search'`. */
  clearSearchAriaLabel?: string;
  /** Message shown when a folder search matches nothing; `{query}` is replaced. */
  folderEmptyStateLabel?: string;
  /** Label of the trailing folder-creation button. Defaults to `'Create new folder'`. */
  createFolderLabel?: string;
  /** Label of the action that cancels folder creation. Defaults to `'Cancel'`. */
  cancelCreatingFolderLabel?: string;
  /** Label of the context-menu action that creates a sibling folder. Defaults to `'Add sibling'`. */
  addSiblingFolderLabel?: string;
  /** Label of the context-menu action that creates a child folder. Defaults to `'Add child'`. */
  addChildFolderLabel?: string;
  /** Inline error for an empty new folder name. */
  createFolderEmptyNameError?: string;
  /** Inline error for a new folder name with forbidden characters. */
  createFolderInvalidNameError?: string;
  /** Inline error for a new folder name that duplicates a sibling. */
  createFolderDuplicateNameError?: string;
  /** Inline error for a new folder named like its parent folder. */
  createFolderSameAsParentNameError?: string;
  /** Label of the action that retries a failed folder listing. Defaults to `'Retry'`. */
  retryLabel?: string;
}

/** Color overrides for the body of the save-to-folder panel. */
export interface SaveToFolderPanelColors {
  /** Section heading text color. Defaults to `--text-primary`. */
  headingText?: string;
  /** Destination path text color. Defaults to `--text-secondary`. */
  destinationText?: string;
  /** Summary row border color. Defaults to `--stroke-tertiary`. */
  summaryBorder?: string;
  /** Summary row background color. Defaults to `--bg-layer-sunken`. */
  summaryBackground?: string;
}

/** Style overrides for the body of the save-to-folder panel. */
export interface SaveToFolderPanelStyles {
  /** Color overrides. */
  colors?: SaveToFolderPanelColors;
  /** Style overrides forwarded to the folder tree. */
  folderTree?: PublishFoldersTreeStyles;
  /** Additional CSS custom properties applied to the body root. */
  cssVars?: CSSProperties;
}

/** Version-choice props; the version section renders only when these are supplied. */
export interface SaveToFolderVersionProps {
  /** Selected version mode. */
  versionMode: SaveVersionMode;
  /** Called with the next version mode. */
  onVersionModeChange: (mode: SaveVersionMode) => void;
  /** The resource's current version, shown in the keep-version option. */
  currentVersion: string;
  /** Value of the new version input. */
  newVersion: string;
  /** Called with the next new version value on every edit. */
  onNewVersionChange: (version: string) => void;
  /** Called when the new version input loses focus. */
  onNewVersionBlur?: () => void;
  /** Error shown under the new version input, already translated by the host. */
  newVersionError?: string;
}

/** Access-rules props; the rules section renders below the tree while a folder of a root with `hasAccessRules` is selected. */
export interface SaveToFolderAccessRulesProps {
  /** Access rules of the selected folder, combined with AND. */
  rules: PublicationRule[];
  /** Called with the full next rules array on add, remove, or clear. */
  onRulesChange: (rules: PublicationRule[]) => void;
  /** Options offered in the rule editor's source picker. */
  sourceOptions: string[];
  /** Whether the selected folder's existing rules are being fetched. Defaults to `false`. */
  isLoading?: boolean;
  /** Whether the most recent existing-rules fetch failed. Defaults to `false`. */
  hasLoadError?: boolean;
  /** Text overrides for the rules section. */
  labels?: PublishAccessRulesLabels;
  /** Style overrides for the rules section. */
  styles?: PublishAccessRulesStyles;
}

/** Props shared by the body and the standalone shell of the save-to-folder panel. */
export interface SaveToFolderPanelBaseProps {
  /** Summary row content; a `type` renders the entity header with icon and type badge. */
  resource: PublishResourceSummary;
  /** Top-level destination roots, in display order. */
  roots: FolderDestinationRoot[];
  /** The committed destination shown in the main view. */
  destination: FolderDestination;
  /** Called with the destination the user selected and confirmed in the folder tree. */
  onDestinationChange: (destination: FolderDestination) => void;
  /** Called when a new folder name is confirmed under `rootKey` at `parentPath`. */
  onCreateFolder: (
    rootKey: string,
    parentPath: string[],
    name: string,
  ) => Promise<void>;
  /** Version choice; omit for an unversioned resource. */
  version?: SaveToFolderVersionProps;
  /** Access rules for a destination under a root with `hasAccessRules`; omit to hide the section. */
  accessRules?: SaveToFolderAccessRulesProps;
  /** Versions history shown as the last section of the main view; omit to hide the section. */
  versionHistory?: VersionHistorySectionProps;
  /** Whether a save is in flight; every control is disabled meanwhile. Defaults to `false`. */
  isSubmitting?: boolean;
  /** Error from the last save attempt, already translated; announced assertively. */
  submitError?: string;
  /** Error from loading folders, already translated; shown above the tree. */
  foldersError?: string;
  /** Called when the user retries a failed folder listing. */
  onRetryFolders?: () => void;
  /** Text overrides for the body. */
  panelLabels?: SaveToFolderPanelLabels;
  /** Style overrides for the body. */
  panelStyles?: SaveToFolderPanelStyles;
  /** Typography class of the section headings. Defaults to `'dial-body-semi-text'`. */
  headingClassName?: string;
  /** Typography class of the destination path. Defaults to `'dial-small-semi-text'`. */
  destinationClassName?: string;
}

/** Props of the body of the save-to-folder panel. */
export interface SaveToFolderPanelProps extends SaveToFolderPanelBaseProps {
  /** Which view to render. */
  view: SaveToFolderView;
  /** Called when the user activates Change in the main view. */
  onChangeFolderClick: () => void;
  /** Ref attached to the Change button, for returning focus after the folder view closes. */
  changeFolderButtonRef?: Ref<HTMLButtonElement>;
  /** Destination selected in the folder view but not yet confirmed. */
  pendingDestination?: FolderDestination;
  /** Called when the user selects or deselects a folder in the folder view. */
  onPendingDestinationChange: (
    destination: FolderDestination | undefined,
  ) => void;
}

/** Text overrides for the shell of the standalone save-to-folder panel. */
export interface StandaloneSaveToFolderPanelLabels {
  /** Main view title and dialog name. Defaults to `'Save'`. */
  title?: string;
  /** Folder view title. Defaults to `'Change folder'`. */
  changeFolderTitle?: string;
  /** Accessible name of the close button. Defaults to `'Close'`. */
  closeAriaLabel?: string;
  /** Accessible name of the folder view's back button. Defaults to `'Back'`. */
  backAriaLabel?: string;
  /** Cancel button label. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /** Save button label. Defaults to `'Save'`. */
  saveLabel?: string;
  /** Save button label while saving. Defaults to `'Saving…'`. */
  savingLabel?: string;
  /** Select button label in the folder view. Defaults to `'Select'`. */
  selectLabel?: string;
}

/** Color overrides for the shell of the standalone save-to-folder panel. */
export interface StandaloneSaveToFolderPanelColors {
  /** Backdrop background color. Defaults to `--bg-backdrop`. */
  backdropBackground?: string;
  /** Panel background color. Defaults to `--bg-layer-raised`. */
  panelBackground?: string;
  /** Panel leading-edge border color. Defaults to `--stroke-secondary`. */
  panelBorder?: string;
  /** Divider color below the header and above the footer. Defaults to `--stroke-tertiary`. */
  dividerBorder?: string;
  /** Scrollbar thumb color of the scrollable body. Defaults to `--stroke-secondary`. */
  scrollbarThumb?: string;
  /** Header title text color. Defaults to `--text-primary`. */
  titleText?: string;
}

/** Props of the standalone save-to-folder panel. */
export interface StandaloneSaveToFolderPanelProps extends SaveToFolderPanelBaseProps {
  /** Whether the panel is open. */
  isOpen: boolean;
  /** Called when the panel asks to close: Close, Cancel in the main view, backdrop, or Escape. */
  onClose: () => void;
  /** Called when the user confirms Save in the main view. */
  onSubmit: () => void;
  /** Whether Save is disabled, e.g. while the new version is invalid. Defaults to `false`. */
  isSubmitDisabled?: boolean;
  /** Focus target restored when the panel closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Called with the folder view's pending destination whenever it changes, including the reset to `destination` on opening and leaving that view. */
  onPendingDestinationChange?: (
    destination: FolderDestination | undefined,
  ) => void;
  /** Text overrides for the shell. */
  labels?: StandaloneSaveToFolderPanelLabels;
  /** Color overrides for the shell. */
  colors?: StandaloneSaveToFolderPanelColors;
  /** Typography class of the header title. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
}
