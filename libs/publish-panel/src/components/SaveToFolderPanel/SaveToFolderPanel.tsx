import {
  FolderDestinationPanelBody,
  FolderDestinationView,
} from '@epam/ai-dial-folder-destination-panel';
import { FC } from 'react';
import type { SaveToFolderPanelProps } from '../../models/save-to-folder-panel';
import { SaveToFolderView } from '../../types/save-to-folder';
import { useSaveToFolderSlots } from '../../utils/use-save-to-folder-slots';

/** Body of the save-to-folder panel: the summary, destination and version choice, or the destination folder tree. */
export const SaveToFolderPanel: FC<SaveToFolderPanelProps> = ({
  view,
  resource,
  version,
  accessRules,
  panelLabels,
  ...bodyProps
}) => {
  const slots = useSaveToFolderSlots({
    ...bodyProps,
    version,
    accessRules,
    panelLabels,
  });

  return (
    <FolderDestinationPanelBody
      {...bodyProps}
      view={
        view === SaveToFolderView.ChangeFolder
          ? FolderDestinationView.ChangeFolder
          : FolderDestinationView.Main
      }
      item={resource}
      mainSections={slots.mainSections}
      renderFolderViewFooter={slots.renderFolderViewFooter}
      panelLabels={slots.panelLabels}
    />
  );
};
