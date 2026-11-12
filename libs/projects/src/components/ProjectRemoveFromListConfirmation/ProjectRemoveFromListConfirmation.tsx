import {
  ConfirmationDialog,
  ConfirmationIdentityRow,
  ResourceSummary,
} from '@epam/ai-dial-chat-shared';
import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import type { ProjectRemoveFromListConfirmationProps } from '../../models/project-remove-from-list-confirmation-props';

const DEFAULT_TITLE = 'Remove from My List';
const DEFAULT_CONSEQUENCES = [
  'You will lose access to this item',
  'Other people keep their access',
  'You will need a new invitation to get it back',
];

/** Confirmation before a project shared with the user leaves their list; it names the project and what removing costs. */
const ProjectRemoveFromListConfirmationComponent: FC<
  ProjectRemoveFromListConfirmationProps
> = ({
  isOpen,
  projectName,
  isRemoving = false,
  onConfirm,
  onClose,
  labels,
}) => (
  <ConfirmationDialog
    open={isOpen}
    title={labels?.title ?? DEFAULT_TITLE}
    variant={ConfirmationPopupVariant.Info}
    identity={
      <ResourceSummary>
        <ConfirmationIdentityRow name={projectName} />
      </ResourceSummary>
    }
    message={
      labels?.message?.(projectName) ?? (
        <>
          Remove <strong>{projectName}</strong> from your list? You&apos;ll need
          a new invitation to access it again.
        </>
      )
    }
    consequences={labels?.consequences ?? DEFAULT_CONSEQUENCES}
    confirmLabel={labels?.confirmLabel ?? DEFAULT_TITLE}
    cancelLabel={labels?.cancelLabel ?? 'Cancel'}
    isLoading={isRemoving}
    loadingStatusLabel={labels?.removingStatusLabel ?? 'Removing…'}
    onConfirm={onConfirm}
    onClose={onClose}
  />
);

export const ProjectRemoveFromListConfirmation = memo(
  ProjectRemoveFromListConfirmationComponent,
);
