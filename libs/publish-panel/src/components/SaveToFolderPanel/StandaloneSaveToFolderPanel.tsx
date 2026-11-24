import {
  buildCssVars,
  EntityHeader,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { FolderDestinationPanel } from '@epam/ai-dial-react-file-manager';
import { Input, RadioGroup } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode, useCallback, useId, useState } from 'react';
import { DEFAULT_DEPENDENCIES_TITLE } from '../../constants/publish-dependencies';
import type { StandaloneSaveToFolderPanelProps } from '../../models/save-to-folder-panel';
import { SaveVersionMode } from '../../types/save-to-folder';
import { PublishDependenciesList } from '../PublishDependenciesList/PublishDependenciesList';
import { VersionHistorySection } from '../VersionHistorySection/VersionHistorySection';
import styles from './StandaloneSaveToFolderPanel.module.scss';

/** End-edge slide-in panel for saving a resource to a chosen folder, with a summary view and a folder view. */
export const StandaloneSaveToFolderPanel: FC<
  StandaloneSaveToFolderPanelProps
> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitDisabled = false,
  returnFocusRef,
  labels = {},
  titleClassName = 'dial-body-semi-text',
  resource,
  roots,
  destination,
  onDestinationChange,
  onPendingDestinationChange,
  getDisabledReason,
  onCreateFolder,
  onCreateFolderError,
  version,
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
    title = 'Save',
    changeFolderTitle = 'Change folder',
    closeAriaLabel = 'Close',
    backAriaLabel = 'Back',
    cancelLabel = 'Cancel',
    saveLabel = 'Save',
    savingLabel = 'Saving…',
    selectLabel = 'Select',
  } = labels;
  const {
    saveToFolderHeading = 'Save to folder',
    versionHeading = 'Version',
    keepVersionLabel = 'Keep version {version}',
    saveAsNewVersionLabel = 'Save as new version',
    newVersionLabel = 'Version',
    newVersionPlaceholder = 'Enter new version',
    createFolderFailedMessage = 'Failed to create the folder. Please try again.',
    ...destinationLabels
  } = panelLabels;
  const { colors, folderTree, cssVars: extraCssVars } = panelStyles;
  const cssVars = {
    ...buildCssVars({
      '--stf-heading-text': colors?.headingText,
      '--stf-note-text': colors?.noteText,
    }),
    ...extraCssVars,
  };

  /* A rejected folder creation is announced through the panel's error slot until the next attempt or pick. */
  const [createFolderError, setCreateFolderError] = useState<string>();
  const handleCreateFolder = useCallback(
    (rootKey: string, parentPath: string[], name: string) => {
      setCreateFolderError(undefined);
      return onCreateFolder(rootKey, parentPath, name);
    },
    [onCreateFolder],
  );
  const handleCreateFolderError = useCallback(
    (error: unknown) => {
      setCreateFolderError(createFolderFailedMessage);
      onCreateFolderError?.(error);
    },
    [createFolderFailedMessage, onCreateFolderError],
  );
  const handleDestinationChange = useCallback(
    (next: Parameters<typeof onDestinationChange>[0]) => {
      setCreateFolderError(undefined);
      onDestinationChange(next);
    },
    [onDestinationChange],
  );

  const newVersionInputId = useId();
  const dependenciesHeadingId = useId();
  const headingClass = mergeClasses(headingClassName, styles.heading);
  const noteClass = mergeClasses(noteClassName, styles.note);
  const hasDependenciesNote =
    Boolean(dependenciesNote) && (dependencies?.length ?? 0) === 0;

  const summary: ReactNode =
    resource.type != null ? (
      <EntityHeader
        item={{
          type: resource.type,
          name: resource.title,
          version: resource.version ?? '',
          iconUrl: resource.iconUrl,
        }}
        iconSize={40}
        hasFeaturedTag={false}
        showVersion
      />
    ) : undefined;

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

  const mainSections = (
    <div className="flex flex-col gap-5" style={cssVars}>
      {destinationNote && <p className={noteClass}>{destinationNote}</p>}

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

      {hasDependenciesNote && (
        <section
          className="flex flex-col gap-2"
          aria-labelledby={dependenciesHeadingId}
        >
          <h2 id={dependenciesHeadingId} className={headingClass}>
            {dependenciesLabels?.title ?? DEFAULT_DEPENDENCIES_TITLE}
          </h2>
          <p className={noteClass}>{dependenciesNote}</p>
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

  return (
    <FolderDestinationPanel
      isOpen={isOpen}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      onPendingDestinationChange={onPendingDestinationChange}
      labels={{
        title,
        changeFolderTitle,
        closeAriaLabel,
        backAriaLabel,
        cancelLabel,
        selectLabel,
      }}
      titleClassName={titleClassName}
      action={{
        label: saveLabel,
        busyLabel: savingLabel,
        isDisabled: isSubmitDisabled,
        onClick: onSubmit,
      }}
      item={{ title: resource.title, summary }}
      roots={roots}
      destination={destination}
      onDestinationChange={handleDestinationChange}
      onCreateFolder={handleCreateFolder}
      onCreateFolderError={handleCreateFolderError}
      getDisabledReason={getDisabledReason}
      mainSections={mainSections}
      isSubmitting={isSubmitting}
      submitError={submitError ?? createFolderError}
      foldersError={foldersError}
      onRetryFolders={onRetryFolders}
      panelLabels={{
        destinationHeading: saveToFolderHeading,
        ...destinationLabels,
      }}
      panelStyles={{ folderTree }}
      headingClassName={headingClassName}
      destinationClassName={destinationClassName}
    />
  );
};
