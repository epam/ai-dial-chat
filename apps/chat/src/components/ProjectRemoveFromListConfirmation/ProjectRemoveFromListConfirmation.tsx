import {
  ProjectRemoveFromListConfirmation as LibProjectRemoveFromListConfirmation,
  type ProjectRemoveFromListConfirmationLabels,
} from '@epam/ai-dial-projects';
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

/** Adapter of the lib's `ProjectRemoveFromListConfirmation`: fills its labels with the app's translations, the same on the project view page and in the sidebar. */
const ProjectRemoveFromListConfirmation: FC<Props> = ({
  isOpen,
  projectName,
  isRemoving,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  const labels = useMemo<ProjectRemoveFromListConfirmationLabels>(
    () => ({
      title: t(ButtonsI18nKeys.RemoveFromMyList),
      confirmLabel: t(ButtonsI18nKeys.RemoveFromMyList),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
      removingStatusLabel: t(CatalogI18nKeys.DetailsUnshareRemovingStatus),
      consequences: [
        t(CatalogI18nKeys.DetailsUnshareConsequenceYouLoseAccess),
        t(CatalogI18nKeys.DetailsUnshareConsequenceOthersKeepAccess),
        t(CatalogI18nKeys.DetailsUnshareConsequenceNeedNewInvitation),
      ],
      message: (name) => (
        <Trans
          i18nKey={CatalogI18nKeys.DetailsUnshareConfirmMessage}
          values={{ name }}
          components={CONFIRMATION_BOLD_COMPONENTS}
        />
      ),
    }),
    [t],
  );

  return (
    <LibProjectRemoveFromListConfirmation
      isOpen={isOpen}
      projectName={projectName}
      isRemoving={isRemoving}
      onConfirm={onConfirm}
      onClose={onClose}
      labels={labels}
    />
  );
};

export default memo(ProjectRemoveFromListConfirmation);
