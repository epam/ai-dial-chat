import {
  DIAL_ICON_SIZE,
  DialSpinner,
  GhostButton,
  NeutralButton,
} from '@epam/ai-dial-ui-kit';
import { FC } from 'react';

/** Text overrides for all user-visible strings in {@link PublishFooter}. */
export interface PublishFooterLabels {
  /** Cancel button label. Default: `'Cancel'`. */
  cancelLabel?: string;
  /** Submit button label when publishing a new version. Default: `'Publish'`. */
  publishDefaultLabel?: string;
  /** Submit button label when replacing an existing version; `{version}` is replaced. */
  updateLabel?: string;
  /** Submit button label while the request is in flight. Default: `'Publishing…'`. */
  publishingInProgressLabel?: string;
}

/** Props for {@link PublishFooter}. */
export interface PublishFooterProps {
  /** The version being published, substituted into the submit label. `undefined` for unversioned resources (e.g. a conversation) — the submit label then always reads `publishDefaultLabel`. */
  version?: string;
  /** Whether this publication already exists at the selected destination folder. */
  hasExistingPublicationInFolder: boolean;
  /** Whether the submit button should be disabled. */
  isSubmitDisabled: boolean;
  /** Whether the submit button should show its loading/spinner state. */
  isSubmitLoading: boolean;
  /** Called when the user cancels the publish flow. */
  onCancel: () => void;
  /** Called when the user confirms the publish/update action. */
  onSubmit: () => void;
  /** Text overrides for all user-visible strings. */
  labels?: PublishFooterLabels;
}

/** Action row for the Publish flow: pinned Cancel and Publish/Update buttons. */
export const PublishFooter: FC<PublishFooterProps> = ({
  version,
  hasExistingPublicationInFolder,
  isSubmitDisabled,
  isSubmitLoading,
  onCancel,
  onSubmit,
  labels = {},
}) => {
  const {
    cancelLabel = 'Cancel',
    publishDefaultLabel = 'Publish',
    updateLabel = 'Update version {version}',
    publishingInProgressLabel = 'Publishing…',
  } = labels;

  const submitLabel = (() => {
    if (isSubmitLoading) {
      return publishingInProgressLabel;
    }
    if (hasExistingPublicationInFolder && version != null) {
      return updateLabel.replace('{version}', version);
    }
    return publishDefaultLabel;
  })();

  return (
    <div className="flex items-center justify-end gap-2 border-t border-tertiary px-3.5 py-4 rtl:flex-row-reverse rtl:justify-start">
      <GhostButton
        label={cancelLabel}
        disabled={isSubmitLoading}
        onClick={onCancel}
      />
      <NeutralButton
        label={submitLabel}
        disabled={isSubmitDisabled}
        iconBefore={
          isSubmitLoading ? <DialSpinner size={DIAL_ICON_SIZE.SM} /> : undefined
        }
        onClick={onSubmit}
      />
    </div>
  );
};
