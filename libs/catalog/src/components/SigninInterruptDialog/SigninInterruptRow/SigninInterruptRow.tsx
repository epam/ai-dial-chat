import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  GhostButton,
  Input,
  LinkButton,
  LiveRegion,
  LiveRegionPoliteness,
  PrimaryButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconAlertCircleFilled } from '@tabler/icons-react';
import type { FC } from 'react';
import type {
  SigninInterruptDialogLabels,
  SigninInterruptDialogProps,
  SigninInterruptDialogRow,
} from '../../../models/signin-interrupt-dialog';
import styles from '../SigninInterruptDialog.module.scss';

interface SigninInterruptRowProps extends Pick<
  SigninInterruptDialogProps,
  'onApiKeyChange' | 'onLogin' | 'onDecline'
> {
  /** Host-resolved presentation of this request. */
  row: SigninInterruptDialogRow;
  /** Resolved copy forwarded from `SigninInterruptDialog`. */
  labels: Required<
    Pick<
      SigninInterruptDialogLabels,
      | 'decline'
      | 'logIn'
      | 'retry'
      | 'apiKeyLabel'
      | 'apiKeyPlaceholder'
      | 'dialNativeHint'
      | 'noCredentialsRequired'
    >
  >;
  /** Typography class of the row name. */
  nameClassName: string;
  /** Typography class of the row error. */
  errorClassName: string;
  /** Typography class of the hint and the no-credentials label. */
  hintClassName: string;
}

/** One pending sign-in request: name, optional API key field, error with Retry, and Decline / Log in actions. */
export const SigninInterruptRow: FC<SigninInterruptRowProps> = ({
  row,
  labels,
  nameClassName,
  errorClassName,
  hintClassName,
  onApiKeyChange,
  onLogin,
  onDecline,
}) => {
  const { id, isProcessing } = row;

  return (
    <div
      role="group"
      aria-label={row.displayName}
      aria-busy={isProcessing}
      className={mergeClasses(
        'flex flex-col gap-2 border-b py-3 last:border-b-0',
        styles.row,
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span
          className={mergeClasses(
            'min-w-0 flex-1 truncate',
            nameClassName,
            styles.name,
          )}
        >
          {row.displayName}
          {row.displayVersion ? ` (${row.displayVersion})` : ''}
        </span>
      </div>

      {row.requiresApiKey && (
        <Input
          id={`signin-interrupt-api-key-${id}`}
          type="password"
          value={row.apiKey}
          placeholder={labels.apiKeyPlaceholder}
          labelProps={{ label: labels.apiKeyLabel }}
          disabled={isProcessing}
          onChange={(value) => onApiKeyChange(id, value ?? '')}
        />
      )}

      <LiveRegion
        politeness={LiveRegionPoliteness.Assertive}
        className={mergeClasses(
          'flex flex-wrap items-center gap-2 wrap-break-word',
          errorClassName,
          styles.error,
        )}
      >
        {row.errorMessage && (
          <>
            <IconAlertCircleFilled size={DIAL_ICON_SIZE.SM} aria-hidden />
            <span>{row.errorMessage}</span>
            <LinkButton
              className="h-auto"
              label={labels.retry}
              onClick={() => onLogin(id)}
            />
          </>
        )}
      </LiveRegion>

      {row.showDialNativeHint && (
        <p
          className={mergeClasses(
            'wrap-break-word',
            hintClassName,
            styles.hint,
          )}
        >
          {labels.dialNativeHint}
        </p>
      )}

      {row.requiresNoCredentials ? (
        <div className="flex justify-end">
          <span className={mergeClasses(hintClassName, styles.hint)}>
            {labels.noCredentialsRequired}
          </span>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <GhostButton
            label={labels.decline}
            className="mobile:flex-1"
            disabled={isProcessing}
            onClick={() => onDecline(id)}
          />
          <PrimaryButton
            label={isProcessing ? undefined : labels.logIn}
            aria-label={isProcessing ? labels.logIn : undefined}
            iconBefore={
              isProcessing ? (
                <Spinner size={16} ariaLabel={labels.logIn} />
              ) : undefined
            }
            className="mobile:flex-1"
            disabled={isProcessing || !row.canSubmitLogin}
            onClick={() => onLogin(id)}
          />
        </div>
      )}
    </div>
  );
};
