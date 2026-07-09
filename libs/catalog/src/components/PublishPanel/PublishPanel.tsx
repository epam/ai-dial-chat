import { TabRow } from '@epam/ai-dial-kit';
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
import { PublishFolderPicker } from '../PublishFolderPicker/PublishFolderPicker';
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
}

/** Props for {@link PublishPanel}. */
export interface PublishPanelProps {
  /** The catalog entity being published. */
  item: CatalogItem;
  /** Previously published versions for this entity. */
  history: PublishHistoryEntry[];
  /**
   * Root-level destination scopes. When there is more than one, each is
   * shown as a switchable tab (e.g. "Shared with me" vs "Organization") and
   * its `children` are the folders offered within that scope. With a single
   * entry, it is shown directly (as its own root folder) with no tabs.
   */
  folderItems: PublishFolderNode[];
  /** Currently selected destination folder path. */
  selectedFolderPath?: string[];
  /** Called when the user selects a destination folder. */
  onSelectedFolderPathChange: (path: string[]) => void;
  /** Called when the user confirms a new folder name. */
  onCreateFolder: (parentPath: string[], name: string) => void;
  /** Whether `item.version` is already published at `selectedFolderPath`. */
  hasExistingVersionInFolder: boolean;
  /** Whether the current user can publish to `selectedFolderPath`. */
  hasWriteAccess: boolean;
  /** Whether a publish request is currently in flight. */
  isSubmitting: boolean;
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
  folderItems,
  selectedFolderPath,
  onSelectedFolderPathChange,
  onCreateFolder,
  hasExistingVersionInFolder,
  hasWriteAccess,
  isSubmitting,
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
  } = texts;

  const [searchQuery, setSearchQuery] = useState('');
  const hasScopeTabs = folderItems.length > 1;
  const [activeScopeIndex, setActiveScopeIndex] = useState(() => {
    if (!selectedFolderPath?.length) {
      return 0;
    }
    const index = folderItems.findIndex(
      (scope) => scope.path[0] === selectedFolderPath[0],
    );
    return index >= 0 ? index : 0;
  });

  const activeScope = folderItems[activeScopeIndex];
  const pickerItems = hasScopeTabs
    ? (activeScope?.children ?? [])
    : folderItems;

  const handleCreateFolder = (parentPath: string[], name: string) => {
    const effectiveParentPath =
      hasScopeTabs && parentPath.length === 0 && activeScope
        ? activeScope.path
        : parentPath;
    onCreateFolder(effectiveParentPath, name);
  };

  const handleScopeChange = (scopeId: string) => {
    const index = folderItems.findIndex(
      (scope) => scope.path.join('/') === scopeId,
    );
    if (index >= 0) {
      setActiveScopeIndex(index);
      onSelectedFolderPathChange([]);
      setSearchQuery('');
    }
  };

  const derived = useMemo(
    () =>
      derivePublishState({
        hasSelectedFolder: Boolean(selectedFolderPath?.length),
        hasExistingVersionInFolder,
        hasWriteAccess,
        isSubmitting,
      }),
    [
      selectedFolderPath,
      hasExistingVersionInFolder,
      hasWriteAccess,
      isSubmitting,
    ],
  );

  const folderName = selectedFolderPath?.[selectedFolderPath.length - 1] ?? '';

  const folderHistory = useMemo(() => {
    if (!selectedFolderPath?.length) {
      return [];
    }
    const key = selectedFolderPath.join('/');
    return history.filter((entry) => entry.folderPath.join('/') === key);
  }, [history, selectedFolderPath]);

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
        {hasScopeTabs && (
          <div className="mb-3">
            <TabRow
              tabs={folderItems.map((scope) => ({
                id: scope.path.join('/'),
                label: scope.name,
              }))}
              activeTabId={activeScope?.path.join('/') ?? ''}
              onTabChange={handleScopeChange}
              activeTabClassName="text-catalog-tab-active"
              inactiveTabClassName="text-catalog-tab-inactive hover:text-catalog-tab-hover border-transparent"
            />
          </div>
        )}
        <PublishFolderPicker
          key={hasScopeTabs ? activeScopeIndex : undefined}
          items={pickerItems}
          selectedPath={selectedFolderPath}
          onSelectedPathChange={onSelectedFolderPathChange}
          onCreateFolder={handleCreateFolder}
          searchQuery={searchQuery}
          disabled={isSubmitting}
        />
        {(derived.calloutKind === PublishCalloutKind.ReplaceWarning ||
          derived.calloutKind === PublishCalloutKind.NoAccess) && (
          <div className="mt-3">
            <DialNotification
              variant={calloutVariant(derived.calloutKind)}
              message={calloutMessage(derived.calloutKind, {
                replaceWarning,
                noAccessError,
                folderName,
                version: item.version,
              })}
            />
          </div>
        )}
      </div>

      {Boolean(selectedFolderPath?.length) && (
        <div>
          <div className="dial-body-semi-text mb-2 text-primary">
            {historyLabel}
          </div>
          <PublishHistoryList
            entries={folderHistory}
            currentVersion={item.version}
          />
        </div>
      )}
    </div>
  );
};

const calloutVariant = (
  kind: PublishCalloutKind.ReplaceWarning | PublishCalloutKind.NoAccess,
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
  kind: PublishCalloutKind.ReplaceWarning | PublishCalloutKind.NoAccess,
  strings: {
    replaceWarning: string;
    noAccessError: string;
    folderName: string;
    version: string;
  },
): ReactNode =>
  kind === PublishCalloutKind.ReplaceWarning
    ? withBoldFolderName(
        strings.replaceWarning.replace('{version}', strings.version),
        strings.folderName,
      )
    : withBoldFolderName(strings.noAccessError, strings.folderName);
