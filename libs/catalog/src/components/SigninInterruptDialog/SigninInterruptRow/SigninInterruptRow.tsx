import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  GhostIconButton,
  Input,
  LiveRegion,
  LiveRegionPoliteness,
  PrimaryButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconAlertCircleFilled, IconX } from '@tabler/icons-react';
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
  /** Typography class of the version, the hint and the no-credentials label. */
  hintClassName: string;
}

/** One pending sign-in request: a single line with name, decline and login actions, plus an optional API key field, error and hint below it. */
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
  const loginLabel = row.errorMessage ? labels.retry : labels.logIn;

  return (
    <div
      role="group"
      aria-label={row.displayName}
      aria-busy={isProcessing}
      className={mergeClasses(
        'flex flex-col gap-2 rounded-lg px-3 py-2',
        styles.row,
      )}
    >
      <div className="flex min-h-8 min-w-0 items-center gap-2">
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span
            className={mergeClasses('truncate', nameClassName, styles.name)}
          >
            {row.displayName}
          </span>
          {row.displayVersion && (
            <span
              className={mergeClasses('shrink-0', hintClassName, styles.hint)}
            >
              {row.displayVersion}
            </span>
          )}
        </span>
        {row.requiresNoCredentials ? (
          <span
            className={mergeClasses('shrink-0', hintClassName, styles.hint)}
          >
            {labels.noCredentialsRequired}
          </span>
        ) : (
          <>
            <GhostIconButton
              size={ElementSize.Small}
              icon={
                <IconX
                  aria-hidden
                  size={DIAL_ICON_SIZE.SM}
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              }
              aria-label={labels.decline}
              disabled={isProcessing}
              onClick={() => onDecline(id)}
            />
            <PrimaryButton
              size={ElementSize.Small}
              label={isProcessing ? undefined : loginLabel}
              aria-label={isProcessing ? loginLabel : undefined}
              iconBefore={
                isProcessing ? (
                  <Spinner size={16} ariaLabel={loginLabel} />
                ) : undefined
              }
              disabled={isProcessing || !row.canSubmitLogin}
              onClick={() => onLogin(id)}
            />
          </>
        )}
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

      {/* Always mounted so an error that appears later is announced. */}
      <LiveRegion
        politeness={LiveRegionPoliteness.Assertive}
        className={mergeClasses(
          'flex items-start gap-1.5 wrap-break-word empty:hidden',
          errorClassName,
          styles.error,
        )}
      >
        {row.errorMessage && (
          <>
            <IconAlertCircleFilled
              className="mt-0.5 shrink-0"
              size={DIAL_ICON_SIZE.SM}
              aria-hidden
            />
            <span>{row.errorMessage}</span>
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
    </div>
  );
};
