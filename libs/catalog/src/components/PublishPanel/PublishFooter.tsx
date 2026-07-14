import { GhostButton, NeutralButton } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE, DialSpinner } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import styles from './PublishFooter.module.scss';

/** Text overrides for all user-visible strings in {@link PublishFooter}. */
export interface PublishFooterTexts {
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
  /** The version being published, substituted into the submit label. */
  version: string;
  /** Whether `version` is already published at the selected destination folder. */
  hasExistingVersionInFolder: boolean;
  /** Whether the submit button should be disabled. */
  isSubmitDisabled: boolean;
  /** Whether the submit button should show its loading/spinner state. */
  isSubmitLoading: boolean;
  /** Called when the user cancels the publish flow. */
  onCancel: () => void;
  /** Called when the user confirms the publish/update action. */
  onSubmit: () => void;
  /** Text overrides for all user-visible strings. */
  texts?: PublishFooterTexts;
}

/**
 * Action row for the Publish flow: Cancel and Publish/Update buttons.
 * Rendered outside the scrollable body so it stays pinned to the bottom.
 * Both Publish and Cancel use secondary/neutral styling — neither is an
 * accented primary action.
 */
export const PublishFooter: FC<PublishFooterProps> = ({
  version,
  hasExistingVersionInFolder,
  isSubmitDisabled,
  isSubmitLoading,
  onCancel,
  onSubmit,
  texts = {},
}) => {
  const {
    cancelLabel = 'Cancel',
    publishDefaultLabel = 'Publish',
    updateLabel = 'Update version {version}',
    publishingInProgressLabel = 'Publishing…',
  } = texts;

  const submitLabel = (() => {
    if (isSubmitLoading) {
      return publishingInProgressLabel;
    }
    if (hasExistingVersionInFolder) {
      return updateLabel.replace('{version}', version);
    }
    return publishDefaultLabel;
  })();

  return (
    <div className="flex items-center justify-end gap-2 border-t border-tertiary px-3.5 py-4">
      <GhostButton
        label={cancelLabel}
        disabled={isSubmitLoading}
        onClick={onCancel}
        className={styles.cancelButton}
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
