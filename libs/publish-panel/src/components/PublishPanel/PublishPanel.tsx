import {
  buildCssVars,
  mergeClasses,
  ResourceSummary,
} from '@epam/ai-dial-chat-shared';
import {
  Checkbox,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  FolderName,
  GhostButton,
  Input,
  Notification,
  NotificationType,
  NotificationVariant,
  Search,
} from '@epam/ai-dial-ui-kit';
import { IconFolder } from '@tabler/icons-react';
import {
  FC,
  ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PUBLISH_PANEL_CLASS } from '../../constants/public-class-names';
import {
  PublicationRule,
  PublishCalloutKind,
  PublishFolderNode,
  PublishResourceSummary,
} from '../../models/publish';
import type { PublishDependenciesLabels } from '../../models/publish-dependencies-list';
import type { PublishDependency } from '../../models/publish-dependency';
import type { PublishPanelStyles } from '../../models/publish-panel-styles';
import type { VersionHistorySectionProps } from '../../models/version-history';
import { PublishPanelView } from '../../types/publish-panel';
import { derivePublishState } from '../../utils/publish-state';
import {
  PublishAccessRules,
  PublishAccessRulesLabels,
} from '../PublishAccessRules/PublishAccessRules';
import { PublishDependenciesList } from '../PublishDependenciesList/PublishDependenciesList';
import { PublishFoldersTree } from '../PublishFoldersTree/PublishFoldersTree';
import { VersionHistorySection } from '../VersionHistorySection/VersionHistorySection';
import styles from './PublishPanel.module.scss';

/** Matches the publish endpoints' own `author` limit, so the field cannot compose a request the backend rejects. */
const MAX_AUTHOR_LENGTH = 200;

/** Text overrides for all user-visible strings in {@link PublishPanel}. */
export interface PublishPanelLabels {
  /** Heading above the destination row, and the accessible name of the folder view. Default: `'Publish to folder'`. */
  folderLabel?: string;
  /** Accessible name of the destination row. Default: `'Destination folder'`. */
  destinationAriaLabel?: string;
  /** Destination row text while no folder is selected. Default: `'No folder selected'`. */
  noFolderSelectedLabel?: string;
  /** Label of the action that opens the folder view once a folder is selected. Default: `'Change'`. */
  changeFolderLabel?: string;
  /** Label of the action that opens the folder view while no folder is selected. Default: `'Choose'`. */
  chooseFolderLabel?: string;
  /** Placeholder for the folder search input. Default: `'Search folders'`. */
  searchPlaceholder?: string;
  /** Accessible label for the search input's clear button. Default: `'Clear search'`. */
  clearSearchAriaLabel?: string;
  /** Label for the display-author field. Default: `'Author'`. */
  authorLabel?: string;
  /** Placeholder for the display-author field. Default: `'Author name'`. */
  authorPlaceholder?: string;
  /** Helper text below the display-author field. Default explains the value is shown as the publication's author. */
  authorHint?: string;
  /** Label for the credentials opt-in. Default: `'Publish with my credentials'`. */
  credentialsLabel?: string;
  /** Caption below the credentials opt-in, stating what ticking it does. Default explains members will use the resource without authorising and that the credential itself is never shown to them. */
  credentialsHint?: string;
  /** Warning callout body shown when the folder already has this version; `{version}` and `{folder}` are replaced, with the folder name rendered bold. */
  replaceWarning?: string;
  /** Error callout body shown when the user lacks write access; `{folder}` is replaced, with the folder name rendered bold. */
  noAccessError?: string;
  /** Error callout body shown when the most recent submit attempt failed. */
  submitError?: string;
  /** Heading of the informational callout stating the publication needs an administrator's approval. Default: `'Admin approval required'`. */
  adminApprovalTitle?: string;
  /** Body of the informational callout under `adminApprovalTitle`. Default: `'We’ll send a request to your organization’s admin. If approved, it will appear in the folder.'`; a host replaces it to name the entity being published. */
  adminApprovalMessage?: string;
  /** Message shown when a folder search query matches no folders; `{query}` is replaced. */
  folderEmptyStateLabel?: string;
  /** Label for the per-row context menu action that creates a folder alongside the clicked folder. */
  addSiblingFolderLabel?: string;
  /** Label for the per-row context menu action that creates a folder inside the clicked folder. */
  addChildFolderLabel?: string;
  /** Label for the action that cancels inline folder creation. Defaults to `'Cancel'`. */
  cancelCreatingFolderLabel?: string;
  /** Inline error shown while creating a folder with an empty name. */
  createFolderEmptyNameError?: string;
  /** Inline error shown while creating a folder whose name contains `..` or a forbidden character. */
  createFolderInvalidNameError?: string;
  /** Inline error shown while creating a folder whose name duplicates a sibling. */
  createFolderDuplicateNameError?: string;
  /** Inline error shown while creating a folder named like its parent folder. */
  createFolderSameAsParentNameError?: string;
  /** Label used for the bucket root as a destination and as `{folder}` in callouts when it is selected. Default: `'Organization'`. */
  rootFolderLabel?: string;
  /** Text overrides for the access-rules section. */
  accessRulesLabels?: PublishAccessRulesLabels;
  /** Text overrides for the private-dependencies section. */
  dependenciesLabels?: PublishDependenciesLabels;
}

/** Props for {@link PublishPanel}. */
export interface PublishPanelProps {
  /**
   * Display metadata for the summary row and for the replace-warning
   * callout's version substitution. A `type` renders the entity-header row;
   * otherwise the row is title-only, unless `renderSummary` replaces it.
   */
  resource?: PublishResourceSummary;
  /**
   * Renders a custom summary row in place of the default title-only row built
   * from `resource.title`. Ignored when `resource.type` is set. Pass
   * `resource` alongside this so the callout's version substitution keeps
   * working.
   */
  renderSummary?: () => ReactNode;
  /**
   * Resources the item refers to that are not in the public bucket, listed read-only under the summary row.
   * Omit it to leave the section out; pass an empty array to keep it mounted for a later list, which is announced when it appears.
   */
  dependencies?: PublishDependency[];
  /** Versions history shown as the last section of the main view. Omit it to leave the section out. */
  versionHistory?: VersionHistorySectionProps;
  /** Which view to show: the main form or the destination folder tree. Default: `PublishPanelView.Main`. */
  view?: PublishPanelView;
  /** Called when the user asks to open the folder view from the destination row. */
  onChangeFolderClick: () => void;
  /** Destination folders available for selection. */
  folderItems: PublishFolderNode[];
  /**
   * Committed destination folder path shown in the destination row.
   * `undefined` means nothing is selected; `[]` means the bucket root itself
   * is selected (a distinct, valid destination).
   */
  selectedFolderPath?: string[];
  /** Folder highlighted in the folder view before the host commits it; `undefined` when none. */
  pendingFolderPath?: string[];
  /** Called when the user picks a folder or the root in the folder view; `undefined` when deselected. */
  onPendingFolderPathChange: (path: string[] | undefined) => void;
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
   * allowed or blocked — see `PublishDerivationInput.allowReplace`.
   * Default `true`.
   */
  allowReplace?: boolean;
  /**
   * Display author recorded on the publication. An empty value is valid and
   * never blocks submission — the host decides what an unset author means.
   */
  author: string;
  /** Called with the next author value on every edit. */
  onAuthorChange: (author: string) => void;
  /**
   * Whether the publication should carry the publisher's own credentials.
   * Only rendered when `onPublishCredentialsChange` is supplied. Default:
   * `false`.
   */
  publishCredentials?: boolean;
  /**
   * Called with the next value when the credentials opt-in is toggled.
   * Supplying it is what renders the control at all — a host with no use for
   * it gets exactly the panel it had before. The panel holds no state of its
   * own for the value.
   */
  onPublishCredentialsChange?: (value: boolean) => void;
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
  /** Typography class for the default summary title (unused when `renderSummary` or `resource.type` is passed). Default: `'dial-body-semi-text'`. */
  summaryTitleClassName?: string;
  /** Typography class for the "Publish to folder" section heading. Default: `'dial-body-semi-text'`. */
  headingClassName?: string;
  /** Typography class for the destination folder path. Default: `'dial-small-semi-text'`. */
  destinationClassName?: string;
  /** Typography class for the folder name emphasised inside the replace-warning and no-access callouts. Default: `'dial-small-paragraph-semi-text'`. */
  calloutFolderNameClassName?: string;
  /** Style overrides. */
  styles?: PublishPanelStyles;
}

/** Scrollable body of the Publish flow: entity summary, destination row with callout, author, credentials and access rules, or the destination folder tree. */
export const PublishPanel: FC<PublishPanelProps> = ({
  view = PublishPanelView.Main,
  onChangeFolderClick,
  resource,
  renderSummary,
  dependencies,
  versionHistory,
  folderItems,
  selectedFolderPath,
  pendingFolderPath,
  onPendingFolderPathChange,
  onCreateFolder,
  expandedPaths,
  onExpandedPathsChange,
  loadingPaths,
  hasExistingPublicationInFolder,
  hasWriteAccess,
  isSubmitting,
  hasSubmitError = false,
  allowReplace = true,
  author,
  onAuthorChange,
  publishCredentials = false,
  onPublishCredentialsChange,
  rules,
  onRulesChange,
  ruleSourceOptions,
  isRulesLoading = false,
  hasRulesLoadError = false,
  labels = {},
  summaryTitleClassName = 'dial-body-semi-text',
  headingClassName = 'dial-body-semi-text',
  destinationClassName = 'dial-small-semi-text',
  calloutFolderNameClassName = 'dial-small-paragraph-semi-text',
  styles: stylesProp = {},
}) => {
  const {
    colors,
    folderTree: folderTreeStyles,
    accessRules: accessRulesStyles,
    dependencies: dependenciesStyles,
  } = stylesProp;
  const cssVars = {
    ...buildCssVars({
      '--pp-summary-title-text': colors?.summaryTitleText,
      '--pp-heading-text': colors?.headingText,
      '--pp-destination-text': colors?.destinationText,
    }),
    ...stylesProp.cssVars,
  };

  /* Border and background belong to `ResourceSummary`'s own row, so they are
     forwarded as colors instead of being set as vars on an ancestor. */
  const summaryColors = {
    border: colors?.summaryBorder,
    background: colors?.summaryBackground,
  };

  const {
    folderLabel = 'Publish to folder',
    destinationAriaLabel = 'Destination folder',
    noFolderSelectedLabel = 'No folder selected',
    changeFolderLabel = 'Change',
    chooseFolderLabel = 'Choose',
    replaceWarning = 'Version {version} is already published in {folder}. Publishing will replace it.',
    noAccessError = "You don't have permission to publish to {folder}. Pick another, or ask an owner for access.",
    submitError = 'Publishing failed. Please try again.',
    adminApprovalTitle = 'Admin approval required',
    adminApprovalMessage = 'We’ll send a request to your organization’s admin. If approved, it will appear in the folder.',
    folderEmptyStateLabel,
    addSiblingFolderLabel,
    addChildFolderLabel,
    cancelCreatingFolderLabel,
    createFolderEmptyNameError,
    createFolderInvalidNameError,
    createFolderDuplicateNameError,
    createFolderSameAsParentNameError,
    rootFolderLabel = 'Organization',
    accessRulesLabels,
    dependenciesLabels,
    searchPlaceholder,
    clearSearchAriaLabel,
    authorLabel = 'Author',
    authorPlaceholder = 'Author name',
    authorHint = 'Shown as the publication’s author. Defaults to you — replace it to credit a team instead.',
    credentialsLabel = 'Publish with my credentials',
    credentialsHint = 'Members will use this without signing in themselves. Your credential itself is never shown to them.',
  } = labels;

  const [searchQuery, setSearchQuery] = useState('');
  /* The kit associates the field with its visible label through this id, so the label is real rather than an aria-label. */
  const authorFieldId = useId();

  const changeFolderButtonRef = useRef<HTMLButtonElement>(null);
  const folderViewRef = useRef<HTMLDivElement>(null);

  const handleSearchChange = (value?: string) => {
    setSearchQuery(value ?? '');
  };

  /*
   * Switching views moves focus into the folder view, and leaving it hands
   * focus back to the button that opened it, as the save panel does.
   */
  const previousViewRef = useRef(view);
  useEffect(() => {
    if (previousViewRef.current === view) return;
    previousViewRef.current = view;
    if (view === PublishPanelView.ChangeFolder) {
      folderViewRef.current?.focus({ preventScroll: true });
    } else {
      changeFolderButtonRef.current?.focus({ preventScroll: true });
    }
  }, [view]);

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

  const defaultSummary = renderSummary ? (
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
  );

  if (view === PublishPanelView.ChangeFolder) {
    return (
      <div
        ref={folderViewRef}
        tabIndex={-1}
        role="group"
        aria-label={folderLabel}
        className={mergeClasses(
          'flex flex-col gap-3 outline-none',
          PUBLISH_PANEL_CLASS.panel,
        )}
        style={cssVars}
      >
        <div role="search">
          <Search
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
            clearLabel={clearSearchAriaLabel}
            aria-label={searchPlaceholder}
          />
        </div>
        <PublishFoldersTree
          items={folderItems}
          selectedPath={pendingFolderPath}
          onSelectedPathChange={onPendingFolderPathChange}
          onCreateFolder={onCreateFolder}
          expandedPaths={expandedPaths}
          onExpandedPathsChange={onExpandedPathsChange}
          loadingPaths={loadingPaths}
          searchQuery={searchQuery}
          disabled={isSubmitting}
          noResultsLabel={folderEmptyStateLabel}
          addSiblingFolderLabel={addSiblingFolderLabel}
          addChildFolderLabel={addChildFolderLabel}
          cancelCreatingFolderLabel={cancelCreatingFolderLabel}
          emptyFolderNameError={createFolderEmptyNameError}
          invalidFolderNameError={createFolderInvalidNameError}
          duplicateFolderNameError={createFolderDuplicateNameError}
          sameAsParentFolderNameError={createFolderSameAsParentNameError}
          rootLabel={rootFolderLabel}
          styles={folderTreeStyles}
        />
      </div>
    );
  }

  const destinationClass = mergeClasses(
    destinationClassName,
    styles.destination,
  );

  return (
    <div
      className={mergeClasses('flex flex-col gap-5', PUBLISH_PANEL_CLASS.panel)}
      style={cssVars}
    >
      {resource?.type != null ? (
        <ResourceSummary
          item={{
            type: resource.type,
            name: resource.title,
            version: resource.version ?? '',
            iconUrl: resource.iconUrl,
          }}
          hasVersionTag={false}
          colors={summaryColors}
        />
      ) : (
        <ResourceSummary colors={summaryColors}>
          {defaultSummary}
        </ResourceSummary>
      )}

      <section>
        <h2
          className={mergeClasses(
            'mb-2',
            headingClassName,
            styles.sectionHeading,
          )}
        >
          {folderLabel}
        </h2>
        {/* Drill-in row, as in the save panel: the whole path is one truncating name and the button opens the folder view. */}
        <div className="flex min-w-0 items-center gap-2">
          <div
            role="group"
            aria-label={destinationAriaLabel}
            className="min-w-0 flex-1"
          >
            {isFolderSelected ? (
              <FolderName
                name={[rootFolderLabel, ...selectedFolderPath].join(' / ')}
                nameClassName={destinationClass}
              />
            ) : (
              <span
                className={mergeClasses('block truncate', destinationClass)}
              >
                {noFolderSelectedLabel}
              </span>
            )}
          </div>
          <GhostButton
            ref={changeFolderButtonRef}
            size={ElementSize.Small}
            label={isFolderSelected ? changeFolderLabel : chooseFolderLabel}
            iconBefore={
              <IconFolder
                size={DIAL_ICON_SIZE.SM}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden
              />
            }
            disabled={isSubmitting}
            onClick={onChangeFolderClick}
          />
        </div>
        {derived.calloutKind === PublishCalloutKind.Info && (
          <div className="my-4">
            <Notification
              type={NotificationType.SectionMessage}
              variant={NotificationVariant.Info}
              title={adminApprovalTitle}
              message={adminApprovalMessage}
            />
          </div>
        )}
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
                  folderNameClassName: calloutFolderNameClassName,
                })}
              />
            </div>
          )}

        {/* Sits with the destination rather than in its own section: the
            folder and the author together say what this publication is, and
            the rules below say who may see it. An empty author is a valid
            state, so nothing here can block submit. */}
        <div className="mt-4">
          <Input
            id={authorFieldId}
            labelProps={{ label: authorLabel }}
            placeholder={authorPlaceholder}
            caption={authorHint}
            value={author}
            onChange={(value) => onAuthorChange(value ?? '')}
            maxLength={MAX_AUTHOR_LENGTH}
            disabled={isSubmitting}
          />
        </div>

        {/* The consequence of ticking this lives in the caption, not the
            label alone: the kit wires the caption as the control's accessible
            description, so nothing here hand-rolls `aria-describedby`. */}
        {onPublishCredentialsChange != null && (
          <div className="mt-4">
            <Checkbox
              labelProps={{ label: credentialsLabel }}
              caption={credentialsHint}
              isSelected={publishCredentials}
              onChange={onPublishCredentialsChange}
              disabled={isSubmitting}
            />
          </div>
        )}

        {/* Nested inside the destination-folder block, and tighter than the
            inter-section gap, so the rules read as scoped to the selection
            above rather than as an independent control. */}
        <div className="mt-4">
          <PublishAccessRules
            rules={rules}
            onRulesChange={onRulesChange}
            sourceOptions={ruleSourceOptions}
            folderName={isFolderSelected ? folderName : undefined}
            disabled={isSubmitting}
            isLoading={isRulesLoading}
            hasLoadError={hasRulesLoadError}
            labels={accessRulesLabels}
            styles={accessRulesStyles}
          />
        </div>
      </section>

      {dependencies != null && (
        <PublishDependenciesList
          dependencies={dependencies}
          labels={dependenciesLabels}
          headingClassName={headingClassName}
          styles={dependenciesStyles}
        />
      )}

      {versionHistory != null && (
        <VersionHistorySection
          headingClassName={headingClassName}
          {...versionHistory}
        />
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
  folderNameClassName: string,
): ReactNode => {
  const [before, after, ...rest] = template.split('{folder}');
  if (after === undefined || rest.length > 0) {
    return template;
  }
  return (
    <>
      {before}
      <strong className={folderNameClassName}>{folderName}</strong>
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
    folderNameClassName: string;
  },
): ReactNode => {
  if (kind === PublishCalloutKind.ReplaceWarning) {
    return withBoldFolderName(
      strings.replaceWarning.replace('{version}', strings.version ?? ''),
      strings.folderName,
      strings.folderNameClassName,
    );
  }
  if (kind === PublishCalloutKind.NoAccess) {
    return withBoldFolderName(
      strings.noAccessError,
      strings.folderName,
      strings.folderNameClassName,
    );
  }
  return strings.submitError;
};
