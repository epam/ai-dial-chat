import {
  buildCssVars,
  mergeClasses,
  ResourceSummary,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  ErrorText,
  FolderName,
  GhostButton,
  Input,
  LinkButton,
  LiveRegion,
  LiveRegionPoliteness,
  RadioGroup,
  Search,
} from '@epam/ai-dial-ui-kit';
import { IconFolder } from '@tabler/icons-react';
import { FC, useId, useMemo, useState } from 'react';
import { DEFAULT_DEPENDENCIES_TITLE } from '../../constants/publish-dependencies';
import type { SaveToFolderPanelProps } from '../../models/save-to-folder-panel';
import { SaveToFolderView, SaveVersionMode } from '../../types/save-to-folder';
import { PublishAccessRules } from '../PublishAccessRules/PublishAccessRules';
import { PublishDependenciesList } from '../PublishDependenciesList/PublishDependenciesList';
import { PublishFoldersTree } from '../PublishFoldersTree/PublishFoldersTree';
import { VersionHistorySection } from '../VersionHistorySection/VersionHistorySection';
import styles from './SaveToFolderPanel.module.scss';

/** Body of the save-to-folder panel: the summary, destination and version choice, or the destination folder tree. */
export const SaveToFolderPanel: FC<SaveToFolderPanelProps> = ({
  view,
  resource,
  roots,
  destination,
  onCreateFolder,
  getDisabledReason,
  onChangeFolderClick,
  changeFolderButtonRef,
  pendingDestination,
  onPendingDestinationChange,
  version,
  accessRules,
  dependencies,
  dependenciesLabels,
  dependenciesStyles,
  dependenciesNote,
  destinationNote,
  noteClassName = 'dial-small-text',
  versionHistory,
  isSubmitting = false,
  submitError,
  foldersError,
  onRetryFolders,
  panelLabels = {},
  panelStyles = {},
  headingClassName = 'dial-body-semi-text',
  destinationClassName = 'dial-small-semi-text',
}) => {
  const {
    saveToFolderHeading = 'Save to folder',
    changeFolderLabel = 'Change',
    destinationAriaLabel = 'Destination folder',
    versionHeading = 'Version',
    keepVersionLabel = 'Keep version {version}',
    saveAsNewVersionLabel = 'Save as new version',
    newVersionLabel = 'Version',
    newVersionPlaceholder = 'Enter new version',
    searchPlaceholder = 'Search folders',
    clearSearchAriaLabel = 'Clear search',
    folderEmptyStateLabel,
    createFolderLabel,
    cancelCreatingFolderLabel,
    addSiblingFolderLabel,
    addChildFolderLabel,
    createFolderEmptyNameError,
    createFolderInvalidNameError,
    createFolderDuplicateNameError,
    createFolderSameAsParentNameError,
    retryLabel = 'Retry',
  } = panelLabels;
  const { colors, folderTree: folderTreeStyles } = panelStyles;
  const cssVars = {
    ...buildCssVars({
      '--stf-heading-text': colors?.headingText,
      '--stf-destination-text': colors?.destinationText,
      '--stf-note-text': colors?.noteText,
    }),
    ...panelStyles.cssVars,
  };
  /* Border and background belong to `ResourceSummary`'s own row, so they are forwarded as colors. */
  const summaryColors = {
    border: colors?.summaryBorder,
    background: colors?.summaryBackground,
  };

  const [searchQuery, setSearchQuery] = useState('');
  const newVersionInputId = useId();
  const destinationReasonId = useId();
  const dependenciesHeadingId = useId();

  const destinationSegments = useMemo(() => {
    const root = roots.find(
      (candidate) => candidate.key === destination.rootKey,
    );
    return [root?.label ?? destination.rootKey, ...destination.path];
  }, [roots, destination]);

  const pendingRoot = roots.find(
    (candidate) => candidate.key === pendingDestination?.rootKey,
  );
  const pendingFolderName = pendingDestination
    ? (pendingDestination.path[pendingDestination.path.length - 1] ??
      pendingRoot?.label)
    : undefined;

  const headingClass = mergeClasses(headingClassName, styles.heading);
  const destinationDisabledReason = getDisabledReason?.(destination);
  const hasDependenciesNote =
    Boolean(dependenciesNote) && (dependencies?.length ?? 0) === 0;

  if (view === SaveToFolderView.ChangeFolder) {
    return (
      <div className="flex flex-col gap-3" style={cssVars}>
        <div role="search">
          <Search
            value={searchQuery}
            onChange={(value) => setSearchQuery(value ?? '')}
            placeholder={searchPlaceholder}
            clearLabel={clearSearchAriaLabel}
            aria-label={searchPlaceholder}
          />
        </div>
        <LiveRegion politeness={LiveRegionPoliteness.Assertive}>
          {foldersError && (
            <div className="flex flex-wrap items-center gap-2">
              <ErrorText text={foldersError} />
              {onRetryFolders && (
                <LinkButton label={retryLabel} onClick={onRetryFolders} />
              )}
            </div>
          )}
        </LiveRegion>
        <PublishFoldersTree
          roots={roots}
          destination={pendingDestination}
          onDestinationChange={onPendingDestinationChange}
          onCreateDestinationFolder={onCreateFolder}
          getDisabledReason={getDisabledReason}
          searchQuery={searchQuery}
          disabled={isSubmitting}
          noResultsLabel={folderEmptyStateLabel}
          createFolderLabel={createFolderLabel}
          cancelCreatingFolderLabel={cancelCreatingFolderLabel}
          addSiblingFolderLabel={addSiblingFolderLabel}
          addChildFolderLabel={addChildFolderLabel}
          emptyFolderNameError={createFolderEmptyNameError}
          invalidFolderNameError={createFolderInvalidNameError}
          duplicateFolderNameError={createFolderDuplicateNameError}
          sameAsParentFolderNameError={createFolderSameAsParentNameError}
          styles={folderTreeStyles}
        />
        {/* Rules are scoped to the folder picked above, so they sit with the tree, as in the Publish panel. */}
        {accessRules &&
          pendingRoot?.hasAccessRules &&
          !(
            pendingDestination && accessRules.isHiddenFor?.(pendingDestination)
          ) && (
            <div className="mt-1">
              <PublishAccessRules
                rules={accessRules.rules}
                onRulesChange={accessRules.onRulesChange}
                sourceOptions={accessRules.sourceOptions}
                folderName={pendingFolderName}
                disabled={isSubmitting}
                isLoading={accessRules.isLoading}
                hasLoadError={accessRules.hasLoadError}
                labels={accessRules.labels}
                styles={accessRules.styles}
              />
            </div>
          )}
      </div>
    );
  }

  const versionItems = version
    ? [
        {
          value: SaveVersionMode.Keep,
          label: keepVersionLabel.replace('{version}', version.currentVersion),
        },
        {
          value: SaveVersionMode.New,
          label: saveAsNewVersionLabel,
          content: (
            <Input
              id={newVersionInputId}
              value={version.newVersion}
              onChange={(value) => version.onNewVersionChange(value ?? '')}
              onBlur={version.onNewVersionBlur}
              labelProps={{ label: newVersionLabel, required: true }}
              placeholder={newVersionPlaceholder}
              error={version.newVersionError}
              invalid={Boolean(version.newVersionError)}
              disabled={isSubmitting}
            />
          ),
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5" style={cssVars}>
      {resource.type != null ? (
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
          <span className={mergeClasses('truncate', headingClass)}>
            {resource.title}
          </span>
        </ResourceSummary>
      )}

      <section className="flex flex-col gap-2">
        <h2 className={headingClass}>{saveToFolderHeading}</h2>
        <div className="flex min-w-0 items-center gap-2">
          {/* The folder icon matches the file manager's; the whole path is one truncating name. */}
          <div
            role="group"
            aria-label={destinationAriaLabel}
            aria-describedby={
              destinationDisabledReason ? destinationReasonId : undefined
            }
            className="min-w-0 flex-1"
          >
            <FolderName
              name={destinationSegments.join(' / ')}
              nameClassName={mergeClasses(
                destinationClassName,
                styles.destination,
              )}
            />
          </div>
          <GhostButton
            ref={changeFolderButtonRef}
            size={ElementSize.Small}
            label={changeFolderLabel}
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
        {destinationNote && (
          <p className={mergeClasses(noteClassName, styles.note)}>
            {destinationNote}
          </p>
        )}
      </section>

      {version && (
        <section className="flex flex-col gap-2">
          <h2 className={headingClass}>{versionHeading}</h2>
          <RadioGroup
            ariaLabel={versionHeading}
            value={version.versionMode}
            onChange={(value) =>
              version.onVersionModeChange(value as SaveVersionMode)
            }
            items={versionItems}
            disabled={isSubmitting}
          />
        </section>
      )}

      <LiveRegion politeness={LiveRegionPoliteness.Assertive}>
        {destinationDisabledReason && (
          <ErrorText
            id={destinationReasonId}
            text={destinationDisabledReason}
          />
        )}
        {submitError && <ErrorText text={submitError} />}
      </LiveRegion>

      {hasDependenciesNote && (
        <section
          className="flex flex-col gap-2"
          aria-labelledby={dependenciesHeadingId}
        >
          <h2 id={dependenciesHeadingId} className={headingClass}>
            {dependenciesLabels?.title ?? DEFAULT_DEPENDENCIES_TITLE}
          </h2>
          <p className={mergeClasses(noteClassName, styles.note)}>
            {dependenciesNote}
          </p>
        </section>
      )}

      {!hasDependenciesNote && dependencies != null && (
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
