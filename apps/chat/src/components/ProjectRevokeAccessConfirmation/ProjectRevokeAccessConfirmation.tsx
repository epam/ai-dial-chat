import type { ProjectDetailsDto } from '@epam/ai-dial-chat-api-client';
import { ProjectRevokeAccessConfirmation as LibProjectRevokeAccessConfirmation } from '@epam/ai-dial-projects';
import { memo, type FC } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CONFIRMATION_BOLD_COMPONENTS } from '../../constants/confirmation-copy';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
} from '../../constants/translation-keys';
import { useProjectRevokeAccess } from '../../hooks/projects/useProjectRevokeAccess';

interface Props {
  project: ProjectDetailsDto;
  onClose: () => void;
}

/** Shared owner confirmation for the project page and the pinned-project menu. */
const ProjectRevokeAccessConfirmation: FC<Props> = ({ project, onClose }) => {
  const { t } = useTranslation();
  const { isRevoking, confirmRevoke } = useProjectRevokeAccess(
    project,
    onClose,
  );
  return (
    <LibProjectRevokeAccessConfirmation
      isOpen
      projectName={project.name}
      labels={{
        title: t(CatalogI18nKeys.DetailsRevokeShareConfirmTitle),
        message: () => (
          <Trans
            i18nKey={CatalogI18nKeys.DetailsRevokeShareConfirmMessage}
            values={{ name: project.name }}
            components={CONFIRMATION_BOLD_COMPONENTS}
          />
        ),
        consequences: [
          t(CatalogI18nKeys.DetailsRevokeShareConsequenceOthersLoseAccess),
          t(CatalogI18nKeys.DetailsRevokeShareConsequenceLinksStopWorking),
          t(CatalogI18nKeys.DetailsRevokeShareConsequenceKeepsYourCopy),
        ],
        confirmLabel: t(ButtonsI18nKeys.RevokeAccess),
        cancelLabel: t(ButtonsI18nKeys.Cancel),
        revokingStatusLabel: t(
          CatalogI18nKeys.DetailsRevokeShareRevokingStatus,
        ),
      }}
      isRevoking={isRevoking}
      onConfirm={() => {
        void confirmRevoke();
      }}
      onClose={onClose}
    />
  );
};

export default memo(ProjectRevokeAccessConfirmation);
