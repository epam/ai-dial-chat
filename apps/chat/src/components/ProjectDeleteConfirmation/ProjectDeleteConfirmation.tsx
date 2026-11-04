import { DeleteConfirmationDialog } from '@epam/ai-dial-chat-shared';
import { memo, type FC } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ProjectsI18nKeys } from '../../constants/translation-keys';
import { useDeleteConfirmationLabels } from '../../hooks/useDeleteConfirmationLabels';

const BOLD_COMPONENTS = { bold: <strong /> };

/** Props for `ProjectDeleteConfirmation`. */
interface Props {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Name of the project being deleted. */
  projectName: string;
  /** Number of chats the delete removes with the project; `0` uses the copy without chats. */
  conversationCount: number;
  /** Whether the delete is in flight. */
  isDeleting: boolean;
  /** Called when the user confirms the delete. */
  onConfirm: () => void;
  /** Called when the dialog is dismissed. */
  onClose: () => void;
}

/** The delete confirmation of a project, with the same copy on the project view page and in the sidebar. */
const ProjectDeleteConfirmation: FC<Props> = ({
  isOpen,
  projectName,
  conversationCount,
  isDeleting,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  const labels = useDeleteConfirmationLabels();

  return (
    <DeleteConfirmationDialog
      open={isOpen}
      title={t(ProjectsI18nKeys.ActionsDeleteConfirmTitle, {
        name: projectName,
      })}
      names={[projectName]}
      message={
        conversationCount > 0 ? (
          <Trans
            i18nKey={ProjectsI18nKeys.ActionsDeleteConfirmWithChatsDescription}
            count={conversationCount}
            components={BOLD_COMPONENTS}
          />
        ) : (
          <Trans
            i18nKey={ProjectsI18nKeys.ActionsDeleteConfirmDescription}
            components={BOLD_COMPONENTS}
          />
        )
      }
      labels={labels}
      isLoading={isDeleting}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
};

export default memo(ProjectDeleteConfirmation);
