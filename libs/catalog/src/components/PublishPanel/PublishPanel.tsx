import { SearchInput } from '@epam/ai-dial-sidebar';
import {
  DialNotification,
  DialTag,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import { FC, ReactNode, useMemo, useState } from 'react';
import { CatalogItem } from '../../models/catalog-item';
import {
  PublishCalloutKind,
  PublishFolderNode,
  PublishHistoryEntry,
} from '../../models/publish';
import { derivePublishState } from '../../utils/publish-state';
import { EntityHeader } from '../EntityHeader/EntityHeader';
import { PublishFoldersTree } from '../PublishFoldersTree/PublishFoldersTree';
import { PublishHistoryList } from '../PublishHistoryList/PublishHistoryList';

/** Text overrides for all user-visible strings in {@link PublishPanel}. */
export interface PublishPanelTexts {
  /** Suffix on the version pill, e.g. "Version 4.0.1 · current". Default: `'current'`. */
  currentVersionSuffix?: string;
  /** Label above the destination folder picker. Default: `'Publish to folder'`. */
  folderLabel?: string;
  /** Placeholder for the folder search input. Default: `'Search folders'`. */
  searchPlaceholder?: string;
  /** Accessible label for the search input's clear button. Default: `'Clear search'`. */
  clearSearchAriaLabel?: string;
  /** Label above the publish history list. Default: `'Versions history'`. */
  historyLabel?: string;
  /** Warning callout body shown when the folder already has this version; `{version}` is replaced. */
  replaceWarning?: string;
  /** Error callout body shown when the user lacks write access. */
  noAccessError?: string;
  /** Error callout body shown when the most recent submit attempt failed. */
  submitError?: string;
  /** Message shown when a folder search query matches no folders; `{query}` is replaced. */
  folderEmptyStateText?: string;
  /** Message shown while publish history is loading. */
  historyLoadingText?: string;
  /** Message shown when publish history failed to load. */
  historyErrorText?: string;
  /** Label used for the bucket root as a destination and as `{folder}` in callouts when it is selected. Default: `'Organization'`. */
  rootFolderLabel?: string;
}

/** Props for {@link PublishPanel}. */
export interface PublishPanelProps {
  /** The catalog entity being published. */
  item: CatalogItem;
  /** Previously published versions for this entity. */
  history: PublishHistoryEntry[];
  /** Whether `history` is currently being fetched. Default: `false`. */
  isHistoryLoading?: boolean;
  /** Whether the most recent history fetch failed. Default: `false`. */
  hasHistoryError?: boolean;
  /** Destination folders available for selection. */
  folderItems: PublishFolderNode[];
  /**
   * Currently selected destination folder path. `undefined` means nothing
   * is selected; `[]` means the bucket root itself is selected (a distinct,
   * valid destination).
   */
  selectedFolderPath?: string[];
  /** Called when the user selects a destination folder or the root; `undefined` when deselected. */
  onSelectedFolderPathChange: (path: string[] | undefined) => void;
  /** Called when the user confirms a new folder name. */
  onCreateFolder: (parentPath: string[], name: string) => void;
  /**
   * Externally-controlled set of expanded folder path keys. Pass this
   * together with `onExpandedPathsChange` when the host lazily fetches a
   * folder's children on expand.
   */
  expandedPaths?: Set<string>;
  /** Called when the set of expanded folders changes; required to control `expandedPaths`. */
  onExpandedPathsChange?: (paths: Set<string>) => void;
  /** Folder path keys currently being fetched by the host. */
  loadingPaths?: Set<string>;
  /** Whether `item.version` is already published at `selectedFolderPath`. */
  hasExistingVersionInFolder: boolean;
  /** Whether the current user can publish to `selectedFolderPath`. */
  hasWriteAccess: boolean;
  /** Whether a publish request is currently in flight. */
  isSubmitting: boolean;
  /** Whether the most recent submit attempt failed. */
  hasSubmitError?: boolean;
  /** Text overrides for all user-visible strings. */
  texts?: PublishPanelTexts;
}

/**
 * Scrollable body of the Publish flow: entity summary, destination folder
 * picker (with a replace-warning or no-access callout when applicable), and
 * the publish history list. The action footer is a sibling rendered by the host (see
 * {@link PublishFooter}) so it can stay pinned outside this scroll area.
 */
export const PublishPanel: FC<PublishPanelProps> = ({
  item,
  history,
  isHistoryLoading = false,
  hasHistoryError = false,
  folderItems,
  selectedFolderPath,
  onSelectedFolderPathChange,
  onCreateFolder,
  expandedPaths,
  onExpandedPathsChange,
  loadingPaths,
  hasExistingVersionInFolder,
  hasWriteAccess,
  isSubmitting,
  hasSubmitError = false,
  texts = {},
}) => {
  const {
    currentVersionSuffix = 'current',
    folderLabel = 'Publish to folder',
    searchPlaceholder = 'Search folders',
    clearSearchAriaLabel = 'Clear search',
    historyLabel = 'Versions history',
    replaceWarning = 'Version {version} is already published in {folder}. Publishing will replace it.',
    noAccessError = "You don't have permission to publish to {folder}. Pick another, or ask an owner for access.",
    submitError = 'Publishing failed. Please try again.',
    folderEmptyStateText,
    historyLoadingText,
    historyErrorText,
    rootFolderLabel = 'Organization',
  } = texts;

  const [searchQuery, setSearchQuery] = useState('');

  const isFolderSelected = selectedFolderPath != null;

  const derived = useMemo(
    () =>
      derivePublishState({
        hasSelectedFolder: isFolderSelected,
        hasExistingVersionInFolder,
        hasWriteAccess,
        isSubmitting,
        hasSubmitError,
      }),
    [
      isFolderSelected,
      hasExistingVersionInFolder,
      hasWriteAccess,
      isSubmitting,
      hasSubmitError,
    ],
  );

  const folderName = isFolderSelected
    ? (selectedFolderPath[selectedFolderPath.length - 1] ?? rootFolderLabel)
    : '';

  const folderHistory = useMemo(() => {
    if (!isFolderSelected) {
      return [];
    }
    const key = selectedFolderPath.join('/');
    return history.filter((entry) => entry.folderPath.join('/') === key);
  }, [history, selectedFolderPath, isFolderSelected]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-tertiary bg-layer-2 px-3.5 py-3">
        <EntityHeader
          item={item}
          iconSize={40}
          hasFeaturedTag={false}
          showVersion={false}
        />
        <DialTag
          label={`Version ${item.version} · ${currentVersionSuffix}`}
          className="shrink-0 whitespace-nowrap !border-tertiary !bg-accent-primary-alpha !text-accent-primary"
        />
      </div>

      <div>
        <div className="dial-body-semi-text mb-2 text-primary">
          {folderLabel}
        </div>
        <div className="mb-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={searchPlaceholder}
            clearLabel={clearSearchAriaLabel}
            wrapperClassName="px-0"
            rowClassName="!rounded-lg"
          />
        </div>
        <PublishFoldersTree
          items={folderItems}
          selectedPath={selectedFolderPath}
          onSelectedPathChange={onSelectedFolderPathChange}
          onCreateFolder={onCreateFolder}
          expandedPaths={expandedPaths}
          onExpandedPathsChange={onExpandedPathsChange}
          loadingPaths={loadingPaths}
          searchQuery={searchQuery}
          disabled={isSubmitting}
          noResultsText={folderEmptyStateText}
          rootLabel={rootFolderLabel}
        />
        {derived.calloutKind !== PublishCalloutKind.None &&
          derived.calloutKind !== PublishCalloutKind.Info && (
            <div className="mt-3">
              <DialNotification
                variant={calloutVariant(derived.calloutKind)}
                message={calloutMessage(derived.calloutKind, {
                  replaceWarning,
                  noAccessError,
                  submitError,
                  folderName,
                  version: item.version,
                })}
              />
            </div>
          )}
      </div>

      {isFolderSelected && (
        <div>
          <div className="dial-body-semi-text mb-2 text-primary">
            {historyLabel}
          </div>
          <PublishHistoryList
            entries={folderHistory}
            isLoading={isHistoryLoading}
            hasError={hasHistoryError}
            currentVersion={item.version}
            loadingText={historyLoadingText}
            errorText={historyErrorText}
          />
        </div>
      )}
    </div>
  );
};

const calloutVariant = (
  kind:
    | PublishCalloutKind.ReplaceWarning
    | PublishCalloutKind.NoAccess
    | PublishCalloutKind.SubmitError,
): NotificationVariant =>
  kind === PublishCalloutKind.ReplaceWarning
    ? NotificationVariant.Warning
    : NotificationVariant.Error;

const withBoldFolderName = (
  template: string,
  folderName: string,
): ReactNode => {
  const [before, after, ...rest] = template.split('{folder}');
  if (after === undefined || rest.length > 0) {
    return template;
  }
  return (
    <>
      {before}
      <strong className="font-semibold">{folderName}</strong>
      {after}
    </>
  );
};

const calloutMessage = (
  kind:
    | PublishCalloutKind.ReplaceWarning
    | PublishCalloutKind.NoAccess
    | PublishCalloutKind.SubmitError,
  strings: {
    replaceWarning: string;
    noAccessError: string;
    submitError: string;
    folderName: string;
    version: string;
  },
): ReactNode => {
  if (kind === PublishCalloutKind.ReplaceWarning) {
    return withBoldFolderName(
      strings.replaceWarning.replace('{version}', strings.version),
      strings.folderName,
    );
  }
  if (kind === PublishCalloutKind.NoAccess) {
    return withBoldFolderName(strings.noAccessError, strings.folderName);
  }
  return strings.submitError;
};
