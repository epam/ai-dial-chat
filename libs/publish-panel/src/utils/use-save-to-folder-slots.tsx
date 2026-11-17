import type {
  FolderDestination,
  FolderDestinationPanelContentLabels,
} from '@epam/ai-dial-react-file-manager';
import { ReactNode, useCallback } from 'react';
import { PublishAccessRules } from '../components/PublishAccessRules/PublishAccessRules';
import { SaveToFolderVersionSection } from '../components/SaveToFolderPanel/SaveToFolderVersionSection';
import { VersionHistorySection } from '../components/VersionHistorySection/VersionHistorySection';
import type { SaveToFolderPanelBaseProps } from '../models/save-to-folder-panel';

/** The Save-specific content a folder destination panel renders around its folder picker. */
interface SaveToFolderSlots {
  /** Version choice for the main view, or `undefined` for an unversioned resource. */
  mainSections: ReactNode;
  /** Access rules for the folder view, scoped to the pending folder. */
  renderFolderViewFooter: (
    pendingDestination: FolderDestination | undefined,
  ) => ReactNode;
  /** The body labels the generic panel understands, with the Save heading mapped onto its destination heading. */
  panelLabels: FolderDestinationPanelContentLabels;
}

/** Builds the version section, access rules and generic body labels from the save-to-folder props. */
export const useSaveToFolderSlots = ({
  roots,
  version,
  accessRules,
  versionHistory,
  isSubmitting = false,
  panelLabels = {},
  panelStyles = {},
  headingClassName = 'dial-body-semi-text',
}: Pick<
  SaveToFolderPanelBaseProps,
  | 'roots'
  | 'version'
  | 'accessRules'
  | 'versionHistory'
  | 'isSubmitting'
  | 'panelLabels'
  | 'panelStyles'
  | 'headingClassName'
>): SaveToFolderSlots => {
  const {
    saveToFolderHeading = 'Save to folder',
    versionHeading = 'Version',
    keepVersionLabel = 'Keep version {version}',
    saveAsNewVersionLabel = 'Save as new version',
    newVersionLabel = 'Version',
    newVersionPlaceholder = 'Enter new version',
    ...bodyLabels
  } = panelLabels;

  const renderFolderViewFooter = useCallback(
    (pendingDestination: FolderDestination | undefined): ReactNode => {
      if (!accessRules) return null;
      const pendingRoot = roots.find(
        (candidate) => candidate.key === pendingDestination?.rootKey,
      );
      if (!pendingRoot?.hasAccessRules) return null;
      /* A destination that takes no rules shows no rules section. */
      if (pendingDestination && accessRules.isHiddenFor?.(pendingDestination)) {
        return null;
      }
      const pendingFolderName = pendingDestination
        ? (pendingDestination.path[pendingDestination.path.length - 1] ??
          pendingRoot.label)
        : undefined;
      /* Rules are scoped to the folder picked above, so they sit with the tree, as in the Publish panel. */
      return (
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
      );
    },
    [accessRules, isSubmitting, roots],
  );

  const versionSection = version ? (
    <SaveToFolderVersionSection
      version={version}
      heading={versionHeading}
      keepVersionLabel={keepVersionLabel}
      saveAsNewVersionLabel={saveAsNewVersionLabel}
      newVersionLabel={newVersionLabel}
      newVersionPlaceholder={newVersionPlaceholder}
      isSubmitting={isSubmitting}
      headingClassName={headingClassName}
      colors={panelStyles.colors}
    />
  ) : undefined;

  /* Versions history is the last section of the main view. */
  const mainSections =
    versionSection || versionHistory ? (
      <>
        {versionSection}
        {versionHistory && (
          <VersionHistorySection
            headingClassName={headingClassName}
            {...versionHistory}
          />
        )}
      </>
    ) : undefined;

  return {
    mainSections,
    renderFolderViewFooter,
    panelLabels: { ...bodyLabels, destinationHeading: saveToFolderHeading },
  };
};
