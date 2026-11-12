import type { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { CSSProperties, ReactNode, Ref, RefObject } from 'react';
import type {
  FolderDestinationItemIcon,
  FolderDestinationLayout,
  FolderDestinationView,
} from '../types/folder-destination-panel';
import type {
  FolderDestination,
  FolderDestinationRoot,
} from './folder-destination';
import type { FolderDestinationTreeStyles } from './folder-destination-tree';

/** The item the panel acts on, shown in its summary row. */
export interface FolderDestinationItem {
  /** Display name shown in the summary row. */
  title: string;
  /** Version shown with the entity header, when the item is versioned. */
  version?: string;
  /** Entity category. When set, the summary row renders the entity header with icon and type label instead of the title-only row. */
  type?: CatalogEntityType;
  /** URL of the entity icon, used only by the entity-header row. */
  iconUrl?: string;
  /** Icon shown beside the title in the title-only row; used only when `type` is not set. Omit for no icon. */
  iconKind?: FolderDestinationItemIcon;
}

/** The panel's primary button, rendered in the footer of the main view. */
export interface FolderDestinationAction {
  /** Button label, e.g. `'Copy'`, `'Move'` or `'Publish'`. */
  label: string;
  /** Icon shown before the label; replaced by a spinner while `FolderDestinationPanelBaseProps.isSubmitting` is `true`. Omit for no icon. */
  icon?: ReactNode;
  /** Button label while `FolderDestinationPanelBaseProps.isSubmitting` is `true`. Defaults to `label`. */
  busyLabel?: string;
  /** Called when the user activates the button. */
  onClick: () => void;
  /** Whether the button is disabled. Defaults to `false`. */
  isDisabled?: boolean;
}

/** Text overrides for the body of the folder destination panel. */
export interface FolderDestinationPanelBodyLabels {
  /** Heading of the destination section. Defaults to `'Destination folder'`. */
  destinationHeading?: string;
  /** Label of the action that opens the folder tree. Defaults to `'Change'`. */
  changeFolderLabel?: string;
  /** Accessible name of the destination path. Defaults to `'Destination folder'`. */
  destinationAriaLabel?: string;
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

/** Color overrides for the body of the folder destination panel. */
export interface FolderDestinationPanelBodyColors {
  /** Section heading text color. Defaults to `--text-primary`. */
  headingText?: string;
  /** Destination path text color. Defaults to `--text-secondary`. */
  destinationText?: string;
  /** Summary row border color. Defaults to `--stroke-tertiary`. */
  summaryBorder?: string;
  /** Summary row background color. Defaults to `--bg-layer-sunken`. */
  summaryBackground?: string;
}

/** Style overrides for the body of the folder destination panel. */
export interface FolderDestinationPanelBodyStyles {
  /** Color overrides. */
  colors?: FolderDestinationPanelBodyColors;
  /** Style overrides forwarded to the folder tree. */
  folderTree?: FolderDestinationTreeStyles;
  /** Additional CSS custom properties applied to the body root. */
  cssVars?: CSSProperties;
}

/** Props shared by the body and the drawer of the folder destination panel. */
export interface FolderDestinationPanelBaseProps {
  /** The item the panel acts on. */
  item: FolderDestinationItem;
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
  /** Lets the user collapse and expand the root nodes of the folder tree. Defaults to `false`. */
  collapsibleRoots?: boolean;
  /** How the folder picker is presented. Defaults to `FolderDestinationLayout.Steps`. */
  layout?: FolderDestinationLayout;
  /** Sections rendered in the main view below the destination, e.g. a version choice. */
  mainSections?: ReactNode;
  /** Content rendered in the folder view below the tree for the pending destination, e.g. access rules. */
  renderFolderViewFooter?: (
    pendingDestination: FolderDestination | undefined,
  ) => ReactNode;
  /** Whether the action is in flight; every control is disabled meanwhile. Defaults to `false`. */
  isSubmitting?: boolean;
  /** Error from the last action attempt, already translated; announced assertively. */
  submitError?: string;
  /** Error from loading folders, already translated; shown above the tree. */
  foldersError?: string;
  /** Called when the user retries a failed folder listing. */
  onRetryFolders?: () => void;
  /** Text overrides for the body. */
  panelLabels?: FolderDestinationPanelBodyLabels;
  /** Style overrides for the body. */
  panelStyles?: FolderDestinationPanelBodyStyles;
  /** Typography class of the section headings. Defaults to `'dial-body-semi-text'`. */
  headingClassName?: string;
  /** Typography class of the destination path. Defaults to `'dial-small-semi-text'`. */
  destinationClassName?: string;
}

/** Props of the body of the folder destination panel. */
export interface FolderDestinationPanelBodyProps extends FolderDestinationPanelBaseProps {
  /** Which view to render. */
  view: FolderDestinationView;
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

/** Text overrides for the drawer of the folder destination panel. */
export interface FolderDestinationPanelLabels {
  /** Main view title and dialog name. Defaults to `'Select destination'`. */
  title?: string;
  /** Folder view title. Defaults to `'Change folder'`. */
  changeFolderTitle?: string;
  /** Accessible name of the close button. Defaults to `'Close'`. */
  closeAriaLabel?: string;
  /** Accessible name of the folder view's back button. Defaults to `'Back'`. */
  backAriaLabel?: string;
  /** Cancel button label. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /** Select button label in the folder view. Defaults to `'Select'`. */
  selectLabel?: string;
}

/** Color overrides for the drawer of the folder destination panel. */
export interface FolderDestinationPanelColors {
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

/** Props of the folder destination drawer. */
export interface FolderDestinationPanelProps extends FolderDestinationPanelBaseProps {
  /** Whether the panel is open. */
  isOpen: boolean;
  /** Called when the panel asks to close: Close, Cancel in the main view, backdrop, or Escape. */
  onClose: () => void;
  /** The primary button of the main view. */
  action: FolderDestinationAction;
  /** Focus target restored when the panel closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Called with the folder view's pending destination whenever it changes, including the reset to `destination` on opening and leaving that view. Never called in `FolderDestinationLayout.Inline`, where a pick is reported through `onDestinationChange`. */
  onPendingDestinationChange?: (
    destination: FolderDestination | undefined,
  ) => void;
  /** Text overrides for the drawer. */
  labels?: FolderDestinationPanelLabels;
  /** Color overrides for the drawer. */
  colors?: FolderDestinationPanelColors;
  /** Typography class of the header title. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
}
