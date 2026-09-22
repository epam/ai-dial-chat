import { ScheduledTaskDeleteConfirmation } from '@epam/ai-dial-scheduled-tasks';
import { memo, type FC } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../constants/translation-keys';

interface Props {
  /** Whether the dialog is open. */
  open: boolean;
  /** Display name of the task being deleted, shown in the identity row and the warning sentence. */
  taskName: string;
  /** Whether the delete request is in flight; swaps the confirm label for a busy label and disables the actions. Defaults to `false`. */
  isDeleting?: boolean;
  /** Fired when the user confirms deletion. */
  onConfirm: () => void;
  /** Fired when the dialog is dismissed via Cancel, the close control, Escape, or an outside click. */
  onClose: () => void;
}

/* The consequences list per design, minus the shared-configurations and
 * users-lose-access rows removed at product request. */
const DELETE_CONSEQUENCE_KEYS = [
  ScheduledTasksI18nKeys.DetailDeleteConsequenceConversationsAccessible,
  ScheduledTasksI18nKeys.DetailDeleteConsequenceCannotBeUndone,
] as const;

/**
 * Delete-task confirmation dialog: the task's identity row, the warning
 * sentence with the bolded task name, and the unordered consequences list.
 */
const ScheduledTaskDeleteModal: FC<Props> = ({
  open,
  taskName,
  isDeleting = false,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <ScheduledTaskDeleteConfirmation
      open={open}
      taskName={taskName}
      title={t(ScheduledTasksI18nKeys.DetailDeleteConfirmTitle)}
      body={
        <Trans
          i18nKey={ScheduledTasksI18nKeys.DetailDeleteConfirmDescription}
          values={{ taskName }}
          components={{
            bold: <strong className="dial-body-paragraph-semi-text" />,
          }}
        />
      }
      consequences={DELETE_CONSEQUENCE_KEYS.map((key) => t(key))}
      cancelLabel={t(ButtonsI18nKeys.Cancel)}
      confirmLabel={t(ButtonsI18nKeys.Delete)}
      pendingLabel={t(ScheduledTasksI18nKeys.DetailDeleteConfirmingLabel)}
      isDeleting={isDeleting}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
};

export default memo(ScheduledTaskDeleteModal);
