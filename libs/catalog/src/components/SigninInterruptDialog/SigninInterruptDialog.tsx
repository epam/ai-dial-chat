import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Checkbox,
  LiveRegion,
  LiveRegionElement,
  NeutralButton,
  Popup,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import type { SigninInterruptDialogProps } from '../../models/signin-interrupt-dialog';
import styles from './SigninInterruptDialog.module.scss';
import { SigninInterruptRow } from './SigninInterruptRow/SigninInterruptRow';

/** Non-dismissible dialog listing pending sign-in requests with per-row Log in / Decline actions. */
export const SigninInterruptDialog: FC<SigninInterruptDialogProps> = ({
  rows,
  statusMessage = '',
  isOfflineUsageConsentShown = false,
  offlineUsageConsent,
  onOfflineUsageConsentChange,
  onApiKeyChange,
  onLogin,
  onDecline,
  onDeclineAll,
  labels,
  colors,
  descriptionClassName = 'dial-small-text',
  nameClassName = 'dial-body-semi-text',
  errorClassName = 'dial-small-text',
  hintClassName = 'dial-small-text',
}) => {
  if (rows.length === 0) return null;

  const rowLabels = {
    decline: labels?.decline ?? 'Decline',
    logIn: labels?.logIn ?? 'Log in',
    retry: labels?.retry ?? 'Retry',
    apiKeyLabel: labels?.apiKeyLabel ?? 'API key',
    apiKeyPlaceholder: labels?.apiKeyPlaceholder ?? 'Enter API key',
    dialNativeHint:
      labels?.dialNativeHint ??
      "Connect your account for offline access. An administrator must separately approve this application's access.",
    noCredentialsRequired:
      labels?.noCredentialsRequired ?? 'No credentials required',
  };

  /* With a single row, its own Decline button already covers it — showing "Decline all" too is a redundant duplicate action. */
  const footer =
    rows.length > 1 ? (
      <div className="flex items-center justify-end gap-2 px-6 py-4">
        <NeutralButton
          label={labels?.declineAll ?? 'Decline all'}
          onClick={onDeclineAll}
        />
      </div>
    ) : undefined;

  return (
    <Popup
      open
      hideClose
      closeOnOutsideClick={false}
      size={PopupSize.Md}
      header={labels?.title ?? 'Sign-in required'}
      footer={footer}
    >
      {/* The popup is portalled, so the color vars are set inside it. */}
      <div
        className="flex flex-col gap-2 px-6 py-4"
        style={buildCssVars({
          '--cat-signin-description-text': colors?.descriptionText,
          '--cat-signin-row-border': colors?.rowBorder,
          '--cat-signin-name-text': colors?.nameText,
          '--cat-signin-error-text': colors?.errorText,
          '--cat-signin-hint-text': colors?.hintText,
        })}
      >
        <p className={mergeClasses(descriptionClassName, styles.description)}>
          {labels?.description ??
            'One or more tools or services need you to sign in before the conversation can continue.'}
        </p>
        <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
          {statusMessage}
        </LiveRegion>
        <div className="flex flex-col">
          {rows.map((row) => (
            <SigninInterruptRow
              key={row.id}
              row={row}
              labels={rowLabels}
              nameClassName={nameClassName}
              errorClassName={errorClassName}
              hintClassName={hintClassName}
              onApiKeyChange={onApiKeyChange}
              onLogin={onLogin}
              onDecline={onDecline}
            />
          ))}
        </div>
        {isOfflineUsageConsentShown && (
          <Checkbox
            className="mt-2"
            isSelected={offlineUsageConsent}
            onChange={onOfflineUsageConsentChange}
            labelProps={{
              label: labels?.offlineUsageConsent ?? 'Allow offline use',
            }}
            caption={
              labels?.offlineUsageConsentHint ??
              'Required for scheduled and background runs.'
            }
          />
        )}
      </div>
    </Popup>
  );
};
