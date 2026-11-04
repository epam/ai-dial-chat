import { DeleteConfirmationDrawer } from '@epam/ai-dial-chat-shared';
import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import { memo, useMemo, type FC } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
} from '../../constants/translation-keys';
import { useDeleteConfirmationLabels } from '../../hooks/useDeleteConfirmationLabels';

const BOLD_COMPONENTS = { bold: <strong /> };

/** Props for `ProjectDeleteConfirmation`. */
interface Props {
  /** Whether the drawer is open. */
  isOpen: boolean;
  /** Name of the project being deleted. */
  projectName: string;
  /** Whether the delete is in flight. */
  isDeleting: boolean;
  /** Called when the user confirms the delete. */
  onConfirm: () => void;
  /** Called when the drawer is dismissed. */
  onClose: () => void;
}

/** The delete confirmation of a project, in the same side panel the catalog shows, with the same copy on the project view page and in the sidebar. */
const ProjectDeleteConfirmation: FC<Props> = ({
  isOpen,
  projectName,
  isDeleting,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  const dialogLabels = useDeleteConfirmationLabels();
  const labels = useMemo(
    () => ({ ...dialogLabels, close: t(ButtonsI18nKeys.Close) }),
    [dialogLabels, t],
  );
  const consequences = useMemo(
    () => [
      t(CatalogI18nKeys.DetailsDeleteConsequenceSharedConfigurations),
      t(CatalogI18nKeys.DetailsDeleteConsequenceUsersLoseAccess),
    ],
    [t],
  );

  return (
    <DeleteConfirmationDrawer
      open={isOpen}
      title={t(ButtonsI18nKeys.Delete)}
      names={[projectName]}
      identityVariant={ConfirmationPopupVariant.Danger}
      message={
        <Trans
          i18nKey={CatalogI18nKeys.DetailsDeleteConfirmMessage}
          values={{ name: projectName }}
          components={BOLD_COMPONENTS}
        />
      }
      consequences={consequences}
      labels={labels}
      isLoading={isDeleting}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
};

export default memo(ProjectDeleteConfirmation);
