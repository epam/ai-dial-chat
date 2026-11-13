import type {
  FolderDestination,
  FolderDestinationPanelBodyLabels,
} from '@epam/ai-dial-react-file-manager';
import { ReactNode, useCallback } from 'react';
import { PublishAccessRules } from '../components/PublishAccessRules/PublishAccessRules';
import { SaveToFolderVersionSection } from '../components/SaveToFolderPanel/SaveToFolderVersionSection';
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
  panelLabels: FolderDestinationPanelBodyLabels;
}

/** Builds the version section, access rules and generic body labels from the save-to-folder props. */
export const useSaveToFolderSlots = ({
  roots,
  version,
  accessRules,
  isSubmitting = false,
  panelLabels = {},
  panelStyles = {},
  headingClassName = 'dial-body-semi-text',
}: Pick<
  SaveToFolderPanelBaseProps,
  | 'roots'
  | 'version'
  | 'accessRules'
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

  const mainSections = version ? (
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

  return {
    mainSections,
    renderFolderViewFooter,
    panelLabels: { ...bodyLabels, destinationHeading: saveToFolderHeading },
  };
};
