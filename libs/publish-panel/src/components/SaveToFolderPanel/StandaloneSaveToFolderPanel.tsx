import { FolderDestinationPanel } from '@epam/ai-dial-folder-destination-panel';
import { FC } from 'react';
import type { StandaloneSaveToFolderPanelProps } from '../../models/save-to-folder-panel';
import { useSaveToFolderSlots } from '../../utils/use-save-to-folder-slots';

/** End-edge slide-in panel for saving a resource to a chosen folder, with a summary view and a folder view. */
export const StandaloneSaveToFolderPanel: FC<
  StandaloneSaveToFolderPanelProps
> = ({
  resource,
  version,
  accessRules,
  panelLabels,
  onSubmit,
  isSubmitDisabled = false,
  labels = {},
  ...panelProps
}) => {
  const {
    saveLabel = 'Save',
    savingLabel = 'Saving…',
    ...drawerLabels
  } = labels;
  const slots = useSaveToFolderSlots({
    ...panelProps,
    version,
    accessRules,
    panelLabels,
  });

  return (
    <FolderDestinationPanel
      {...panelProps}
      item={resource}
      labels={{ title: 'Save', ...drawerLabels }}
      action={{
        label: saveLabel,
        busyLabel: savingLabel,
        onClick: onSubmit,
        isDisabled: isSubmitDisabled,
      }}
      mainSections={slots.mainSections}
      renderFolderViewFooter={slots.renderFolderViewFooter}
      panelLabels={slots.panelLabels}
    />
  );
};
