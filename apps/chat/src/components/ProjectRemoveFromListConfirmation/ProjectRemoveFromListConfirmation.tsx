import {
  ConfirmationDialog,
  ConfirmationIdentityRow,
  ResourceSummary,
} from '@epam/ai-dial-chat-shared';
import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import { memo, useMemo, type FC } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CONFIRMATION_BOLD_COMPONENTS } from '../../constants/confirmation-copy';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
} from '../../constants/translation-keys';

/** Props for `ProjectRemoveFromListConfirmation`. */
interface Props {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Name of the shared project being removed. */
  projectName: string;
  /** Whether the removal is in flight. */
  isRemoving: boolean;
  /** Called when the user confirms the removal. */
  onConfirm: () => void;
  /** Called when the dialog is dismissed. */
  onClose: () => void;
}

/** The confirmation before a project shared with the user leaves their list; the same on the project view page and in the sidebar. */
const ProjectRemoveFromListConfirmation: FC<Props> = ({
  isOpen,
  projectName,
  isRemoving,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  const consequences = useMemo(
    () => [
      t(CatalogI18nKeys.DetailsUnshareConsequenceYouLoseAccess),
      t(CatalogI18nKeys.DetailsUnshareConsequenceOthersKeepAccess),
      t(CatalogI18nKeys.DetailsUnshareConsequenceNeedNewInvitation),
    ],
    [t],
  );

  return (
    <ConfirmationDialog
      open={isOpen}
      title={t(ButtonsI18nKeys.RemoveFromMyList)}
      variant={ConfirmationPopupVariant.Info}
      identity={
        <ResourceSummary>
          <ConfirmationIdentityRow name={projectName} />
        </ResourceSummary>
      }
      message={
        <Trans
          i18nKey={CatalogI18nKeys.DetailsUnshareConfirmMessage}
          values={{ name: projectName }}
          components={CONFIRMATION_BOLD_COMPONENTS}
        />
      }
      consequences={consequences}
      confirmLabel={t(ButtonsI18nKeys.RemoveFromMyList)}
      cancelLabel={t(ButtonsI18nKeys.Cancel)}
      isLoading={isRemoving}
      loadingStatusLabel={t(CatalogI18nKeys.DetailsUnshareRemovingStatus)}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
};

export default memo(ProjectRemoveFromListConfirmation);
