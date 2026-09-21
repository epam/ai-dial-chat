import {
  ButtonVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Popup,
} from '@epam/ai-dial-ui-kit';
import { IconTrashX } from '@tabler/icons-react';
import { memo, useMemo, type FC } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../constants/translation-keys';
import styles from './ScheduledTaskDeleteModal.module.scss';

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

  const modalButtons = useMemo(
    () => [
      /* Both actions freeze while deleting — dismissing the dialog mid-
         request would leave the page state contradicting the in-flight
         delete. */
      {
        label: t(ButtonsI18nKeys.Cancel),
        onClick: onClose,
        disabled: isDeleting,
      },
      {
        label: isDeleting
          ? t(ScheduledTasksI18nKeys.DetailDeleteConfirmingLabel)
          : t(ButtonsI18nKeys.Delete),
        variant: ButtonVariant.Danger,
        iconBefore: (
          <IconTrashX
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
            aria-hidden
          />
        ),
        onClick: onConfirm,
        disabled: isDeleting,
      },
    ],
    [isDeleting, onClose, onConfirm, t],
  );

  return (
    <Popup
      open={open}
      header={t(ScheduledTasksI18nKeys.DetailDeleteConfirmTitle)}
      onClose={onClose}
      /* The design's 440px cap — see ScheduledTaskDeleteModal.module.scss
       * for why this is a stylesheet rule and not a max-w-* className. */
      className={styles.modal}
      mainButtons={modalButtons}
    >
      {/*
       * Matches the "Delete Task PopUp" design: the task's identity row,
       * the warning sentence, then the unordered consequences list.
       */}
      <div className="flex flex-col gap-4 px-6 pb-4 pt-2">
        <div className="flex h-11 items-center rounded-lg border border-error-alpha bg-error px-3">
          <span className="dial-small-semi-text truncate">{taskName}</span>
        </div>
        <p className="dial-body-paragraph-text break-words">
          {/*
           * Trans interpolates the task name with markup so translators
           * keep one sentence; `bold` maps to the <bold> tag in the
           * locale string.
           */}
          <Trans
            i18nKey={ScheduledTasksI18nKeys.DetailDeleteConfirmDescription}
            values={{ taskName }}
            components={{
              bold: <strong className="dial-body-paragraph-semi-text" />,
            }}
          />
        </p>
        <ul className="flex flex-col gap-2 ps-[18px]">
          {DELETE_CONSEQUENCE_KEYS.map((key) => (
            <li
              key={key}
              className="dial-body-paragraph-text list-disc text-secondary marker:text-secondary"
            >
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </Popup>
  );
};

export default memo(ScheduledTaskDeleteModal);
