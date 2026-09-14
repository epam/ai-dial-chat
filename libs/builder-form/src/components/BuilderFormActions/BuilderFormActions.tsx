import {
  DIAL_ICON_SIZE,
  NeutralButton,
  PrimaryButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import type { BuilderFormActionsProps } from '../../models/builder-form-actions-props';

/** The form's cancel/submit action pair — in the header on desktop, in the mobile sticky footer. */
export const BuilderFormActions: FC<BuilderFormActionsProps> = ({
  labels,
  onCancel,
  onSubmit,
  isCancelDisabled = false,
  isSubmitDisabled = false,
  isSubmitting = false,
  buttonClassName,
}) => (
  <>
    <NeutralButton
      label={labels.cancelButtonLabel}
      onClick={onCancel}
      disabled={isCancelDisabled}
      className={buttonClassName}
    />
    {/*
     * The submit button is disabled both while a submit is in flight and
     * while the form is simply incomplete, so `disabled` alone cannot tell
     * the two apart. The spinner, `aria-busy` and the live region rendered
     * by the header are what distinguish "working" from "not ready yet".
     *
     * The spinner is hidden from assistive tech so the button keeps
     * `submitButtonLabel` as its accessible name — a name that changed
     * mid-submit would be read as a different control.
     */}
    <PrimaryButton
      label={labels.submitButtonLabel}
      onClick={onSubmit}
      disabled={isSubmitDisabled}
      aria-busy={isSubmitting}
      className={buttonClassName}
      iconBefore={
        isSubmitting ? (
          <span aria-hidden>
            <Spinner size={DIAL_ICON_SIZE.SM} />
          </span>
        ) : undefined
      }
    />
  </>
);
