import {
  ConfirmationDialog,
  ConfirmationIdentityRow,
  ResourceSummary,
} from '@epam/ai-dial-chat-shared';
import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import type { ProjectRevokeAccessConfirmationProps } from '../../models/project-revoke-access-confirmation-props';

const DEFAULT_TITLE = 'Revoke access';
const DEFAULT_CONSEQUENCES = [
  'People you shared with will lose access',
  'Existing share links will stop working',
  'Your own copy will remain available',
];

/** Confirms revoking a project's shared access without removing the owner's copy. */
const ProjectRevokeAccessConfirmationComponent: FC<
  ProjectRevokeAccessConfirmationProps
> = ({
  isOpen,
  projectName,
  isRevoking = false,
  onConfirm,
  onClose,
  labels,
}) => (
  <ConfirmationDialog
    open={isOpen}
    title={labels?.title ?? DEFAULT_TITLE}
    variant={ConfirmationPopupVariant.Danger}
    identity={
      <ResourceSummary>
        <ConfirmationIdentityRow name={projectName} />
      </ResourceSummary>
    }
    message={
      labels?.message?.(projectName) ?? (
        <>
          Revoke shared access to <strong>{projectName}</strong>? Anyone you
          shared it with will lose access.
        </>
      )
    }
    consequences={labels?.consequences ?? DEFAULT_CONSEQUENCES}
    confirmLabel={labels?.confirmLabel ?? DEFAULT_TITLE}
    cancelLabel={labels?.cancelLabel ?? 'Cancel'}
    isLoading={isRevoking}
    loadingStatusLabel={labels?.revokingStatusLabel ?? 'Revoking access…'}
    onConfirm={onConfirm}
    onClose={onClose}
  />
);

export const ProjectRevokeAccessConfirmation = memo(
  ProjectRevokeAccessConfirmationComponent,
);
