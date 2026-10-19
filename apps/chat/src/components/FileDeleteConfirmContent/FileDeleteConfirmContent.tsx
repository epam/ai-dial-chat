import { DeleteConfirmationView } from '@epam/ai-dial-chat-shared';
import { memo, type FC } from 'react';
import { Trans } from 'react-i18next';
import { CONFIRMATION_BOLD_COMPONENTS } from '../../constants/confirmation-copy';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';
import { useDeleteConfirmationLabels } from '../../hooks/useDeleteConfirmationLabels';

interface Props {
  /** Paths of the files and folders about to be deleted, as the grid reports them. */
  names: string[];
}

/**
 * Body of the file manager's delete confirmation, matching the block every
 * other delete surface shows. The dialog frame and its actions belong to
 * `@epam/ai-dial-react-file-manager`, which takes this as its
 * `contentRenderer`.
 */
const FileDeleteConfirmContent: FC<Props> = ({ names }) => {
  const labels = useDeleteConfirmationLabels();

  /* The grid reports full paths; the dialog names the item, not its location. */
  const displayNames = names.map((name) => name.split('/').pop() ?? name);

  return (
    <DeleteConfirmationView
      names={displayNames}
      labels={labels}
      message={
        displayNames.length === 1 ? (
          <Trans
            i18nKey={DialFileManagerI18nKeys.DeleteConfirmMessageSingle}
            values={{ name: displayNames[0] }}
            components={CONFIRMATION_BOLD_COMPONENTS}
          />
        ) : (
          <Trans
            i18nKey={DialFileManagerI18nKeys.DeleteConfirmMessageMultiple}
            values={{ count: names.length }}
            components={CONFIRMATION_BOLD_COMPONENTS}
          />
        )
      }
    />
  );
};

export default memo(FileDeleteConfirmContent);
