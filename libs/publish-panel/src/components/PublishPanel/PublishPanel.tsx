import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { SearchInput } from '@epam/ai-dial-sidebar';
import {
  Notification,
  NotificationType,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import { FC, ReactNode, useMemo, useState } from 'react';
import {
  PublicationRule,
  PublishCalloutKind,
  PublishFolderNode,
  PublishHistoryEntry,
  PublishResourceSummary,
} from '../../models/publish';
import { derivePublishState } from '../../utils/publish-state';
import {
  PublishAccessRules,
  PublishAccessRulesLabels,
} from '../PublishAccessRules/PublishAccessRules';
import { PublishFoldersTree } from '../PublishFoldersTree/PublishFoldersTree';
import { PublishHistoryList } from '../PublishHistoryList/PublishHistoryList';
import styles from './PublishPanel.module.scss';

/** Text overrides for all user-visible strings in {@link PublishPanel}. */
export interface PublishPanelLabels {
  /** Label above the destination folder picker. Default: `'Publish to folder'`. */
  folderLabel?: string;
  /** Placeholder for the folder search input. Default: `'Search folders'`. */
  searchPlaceholder?: string;
  /** Accessible label for the search input's clear button. Default: `'Clear search'`. */
  clearSearchAriaLabel?: string;
  /** Label above the publish history list. Default: `'Versions history'`. */
  historyLabel?: string;
  /** Warning callout body shown when the folder already has this version; `{version}` and `{folder}` are replaced, with the folder name rendered bold. */
  replaceWarning?: string;
  /** Error callout body shown when the user lacks write access; `{folder}` is replaced, with the folder name rendered bold. */
  noAccessError?: string;
  /** Error callout body shown when the most recent submit attempt failed. */
  submitError?: string;
  /** Message shown when a folder search query matches no folders; `{query}` is replaced. */
  folderEmptyStateLabel?: string;
  /** Label for the per-row context menu action that creates a folder alongside the clicked folder. */
  addSiblingFolderLabel?: string;
  /** Label for the per-row context menu action that creates a folder inside the clicked folder. */
  addChildFolderLabel?: string;
  /** Inline error shown while creating a folder with an empty name. */
  createFolderEmptyNameError?: string;
  /** Inline error shown while creating a folder whose name contains `..` or a forbidden character. */
  createFolderInvalidNameError?: string;
  /** Inline error shown while creating a folder whose name duplicates a sibling. */
  createFolderDuplicateNameError?: string;
  /** Message shown while publish history is loading. */
  historyLoadingLabel?: string;
  /** Message shown when publish history failed to load. */
  historyErrorLabel?: string;
  /** Label used for the bucket root as a destination and as `{folder}` in callouts when it is selected. Default: `'Organization'`. */
  rootFolderLabel?: string;
  /** Text overrides for the access-rules section. */
  accessRulesLabels?: PublishAccessRulesLabels;
}

/** Props for {@link PublishPanel}. */
export interface PublishPanelProps {
  /**
   * Display metadata for the summary row and for version-derived behavior:
   * the replace-warning callout's version substitution, and whether the
   * publish-history section is shown at all (only when `version` is set).
   * Title-only rendering applies when `renderSummary` is absent.
   */
  resource?: PublishResourceSummary;
  /**
   * Renders a custom summary row (e.g. a full entity header with icon and
   * type badge) in place of the default title-only row built from
   * `resource.title`. Pass `resource` alongside this so version-derived
   * behavior (callout, history section) keeps working.
   */
  renderSummary?: () => ReactNode;
  /** Previously published entries for this item. */
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
  onCreateFolder: (parentPath: string[], name: string) => Promise<void>;
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
  /**
   * Whether `selectedFolderPath` already has this publication — this exact
   * version, for a versioned `resource`, or any prior entry at all, for an
   * unversioned one.
   */
  hasExistingPublicationInFolder: boolean;
  /** Whether the current user can publish to `selectedFolderPath`. */
  hasWriteAccess: boolean;
  /** Whether a publish request is currently in flight. */
  isSubmitting: boolean;
  /** Whether the most recent submit attempt failed. */
  hasSubmitError?: boolean;
  /**
   * Whether resubmitting when `hasExistingPublicationInFolder` is true is
   * allowed (catalog default) or blocked (conversations — see
   * `PublishDerivationInput.allowReplace`). Default `true`.
   */
  allowReplace?: boolean;
  /** Current access rules, combined with AND. */
  rules: PublicationRule[];
  /** Called with the full next rules array on add, remove, or clear. */
  onRulesChange: (rules: PublicationRule[]) => void;
  /** Options offered in the access-rules editor's source picker. */
  ruleSourceOptions: string[];
  /** Whether existing rules are currently being fetched for the selected folder. Default: `false`. */
  isRulesLoading?: boolean;
  /** Whether the most recent existing-rules fetch failed. Default: `false`. */
  hasRulesLoadError?: boolean;
  /** Text overrides for all user-visible strings. */
  labels?: PublishPanelLabels;
  /** Typography class for the default summary title (unused when `renderSummary` is passed). Default: `'dial-body-semi-text'`. */
  summaryTitleClassName?: string;
  /** Typography class for the "Publish to folder" and "Versions history" section headings. Default: `'dial-body-semi-text'`. */
  headingClassName?: string;
  /** Color overrides. */
  colors?: PublishPanelColors;
}

/** Color overrides for {@link PublishPanel}, applied as CSS custom properties with app theme fallbacks. */
export interface PublishPanelColors {
  /** Summary row border color. Fallback: `--stroke-tertiary`. */
  summaryBorder?: string;
  /** Summary row background color. Fallback: `--bg-layer-sunken`. */
  summaryBackground?: string;
  /** Default summary title text color. Fallback: `--text-primary`. */
  summaryTitleText?: string;
  /** Section heading text color. Fallback: `--text-primary`. */
  headingText?: string;
}

/** Scrollable body of the Publish flow: entity summary, destination folder picker with callout, and publish history. */
export const PublishPanel: FC<PublishPanelProps> = ({
  resource,
  renderSummary,
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
  hasExistingPublicationInFolder,
  hasWriteAccess,
  isSubmitting,
  hasSubmitError = false,
  allowReplace = true,
  rules,
  onRulesChange,
  ruleSourceOptions,
  isRulesLoading = false,
  hasRulesLoadError = false,
  labels = {},
  summaryTitleClassName = 'dial-body-semi-text',
  headingClassName = 'dial-body-semi-text',
  colors,
}) => {
  const cssVars = buildCssVars({
    '--pp-summary-border': colors?.summaryBorder,
    '--pp-summary-bg': colors?.summaryBackground,
    '--pp-summary-title-text': colors?.summaryTitleText,
    '--pp-heading-text': colors?.headingText,
  });

  const {
    folderLabel = 'Publish to folder',
    searchPlaceholder = 'Search folders',
    clearSearchAriaLabel = 'Clear search',
    historyLabel = 'Versions history',
    replaceWarning = 'Version {version} is already published in {folder}. Publishing will replace it.',
    noAccessError = "You don't have permission to publish to {folder}. Pick another, or ask an owner for access.",
    submitError = 'Publishing failed. Please try again.',
    folderEmptyStateLabel,
    addSiblingFolderLabel,
    addChildFolderLabel,
    createFolderEmptyNameError,
    createFolderInvalidNameError,
    createFolderDuplicateNameError,
    historyLoadingLabel,
    historyErrorLabel,
    rootFolderLabel = 'Organization',
    accessRulesLabels,
  } = labels;

  const [searchQuery, setSearchQuery] = useState('');

  const isFolderSelected = selectedFolderPath != null;

  const derived = useMemo(
    () =>
      derivePublishState({
        hasSelectedFolder: isFolderSelected,
        hasExistingPublicationInFolder,
        hasWriteAccess,
        isSubmitting,
        hasSubmitError,
        allowReplace,
      }),
    [
      isFolderSelected,
      hasExistingPublicationInFolder,
      hasWriteAccess,
      isSubmitting,
      hasSubmitError,
      allowReplace,
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
      <div
        style={cssVars}
        className={mergeClasses(
          'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3',
          styles.summaryRow,
        )}
      >
        {renderSummary ? (
          renderSummary()
        ) : (
          <span
            className={mergeClasses(
              'truncate',
              summaryTitleClassName,
              styles.summaryTitle,
            )}
          >
            {resource?.title}
          </span>
        )}
      </div>

      <div>
        <div
          className={mergeClasses(
            'mb-2',
            headingClassName,
            styles.sectionHeading,
          )}
        >
          {folderLabel}
        </div>
        <div className="mb-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            labels={{
              placeholder: searchPlaceholder,
              clearLabel: clearSearchAriaLabel,
            }}
            styles={{ wrapperClassName: 'px-0', rowClassName: '!rounded-lg' }}
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
          noResultsLabel={folderEmptyStateLabel}
          addSiblingFolderLabel={addSiblingFolderLabel}
          addChildFolderLabel={addChildFolderLabel}
          emptyFolderNameError={createFolderEmptyNameError}
          invalidFolderNameError={createFolderInvalidNameError}
          duplicateFolderNameError={createFolderDuplicateNameError}
          rootLabel={rootFolderLabel}
        />
        {derived.calloutKind !== PublishCalloutKind.None &&
          derived.calloutKind !== PublishCalloutKind.Info && (
            <div className="mt-3">
              <Notification
                type={NotificationType.SectionMessage}
                variant={calloutVariant(derived.calloutKind)}
                message={calloutMessage(derived.calloutKind, {
                  replaceWarning,
                  noAccessError,
                  submitError,
                  folderName,
                  version: resource?.version,
                })}
              />
            </div>
          )}
      </div>

      <PublishAccessRules
        rules={rules}
        onRulesChange={onRulesChange}
        sourceOptions={ruleSourceOptions}
        disabled={isSubmitting}
        isLoading={isRulesLoading}
        hasLoadError={hasRulesLoadError}
        labels={accessRulesLabels}
      />

      {isFolderSelected && resource?.version != null && (
        <div>
          <div
            className={mergeClasses(
              'mb-2',
              headingClassName,
              styles.sectionHeading,
            )}
          >
            {historyLabel}
          </div>
          <PublishHistoryList
            entries={folderHistory}
            isLoading={isHistoryLoading}
            hasError={hasHistoryError}
            currentVersion={resource.version}
            loadingLabel={historyLoadingLabel}
            errorLabel={historyErrorLabel}
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
    version?: string;
  },
): ReactNode => {
  if (kind === PublishCalloutKind.ReplaceWarning) {
    return withBoldFolderName(
      strings.replaceWarning.replace('{version}', strings.version ?? ''),
      strings.folderName,
    );
  }
  if (kind === PublishCalloutKind.NoAccess) {
    return withBoldFolderName(strings.noAccessError, strings.folderName);
  }
  return strings.submitError;
};
