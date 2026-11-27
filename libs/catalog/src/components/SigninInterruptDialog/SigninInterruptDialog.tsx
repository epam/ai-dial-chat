import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Badge,
  ButtonVariant,
  Checkbox,
  LiveRegion,
  LiveRegionElement,
  Popup,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import type { SigninInterruptDialogProps } from '../../models/signin-interrupt-dialog';
import styles from './SigninInterruptDialog.module.scss';
import { SigninInterruptRow } from './SigninInterruptRow/SigninInterruptRow';

/** Non-dismissible dialog listing pending sign-in requests as compact rows with per-row Log in / Decline actions. */
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

  const title = labels?.title ?? 'Sign-in required';
  const logInTo =
    labels?.logInTo ?? ((name: string): string => `Log in to ${name}`);
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

  /*
   * With several rows the footer offers `Decline all` and `Log in to …`. A
   * single row carries its own Log in, so the footer only offers Cancel,
   * the explicit way out of the non-dismissible dialog.
   */
  const hasFooter = rows.length > 1;
  const nextRow = hasFooter
    ? rows.find(
        (row) =>
          !row.requiresNoCredentials && !row.isProcessing && row.canSubmitLogin,
      )
    : undefined;

  return (
    <Popup
      open
      hideClose
      closeOnOutsideClick={false}
      size={PopupSize.Md}
      ariaLabel={title}
      header={
        <span className="flex items-center gap-2">
          {title}
          {hasFooter && <Badge label={String(rows.length)} />}
        </span>
      }
      additionalButtonsOnLeft={hasFooter}
      additionalButtons={[
        {
          label: hasFooter
            ? (labels?.declineAll ?? 'Decline all')
            : (labels?.cancel ?? 'Cancel'),
          onClick: onDeclineAll,
        },
      ]}
      mainButtons={
        nextRow
          ? [
              {
                label: logInTo(nextRow.displayName),
                variant: ButtonVariant.Primary,
                onClick: () => onLogin(nextRow.id),
              },
            ]
          : undefined
      }
    >
      {/* The popup is portalled, so the color vars are set inside it. */}
      <div
        className="flex flex-col gap-3 px-6 py-4"
        style={buildCssVars({
          '--cat-signin-description-text': colors?.descriptionText,
          '--cat-signin-row-hover-background': colors?.rowHoverBackground,
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
        {/* Negative margin lines row text up with the description while the hover tint keeps its own padding. */}
        <div className="-mx-3 flex flex-col gap-0.5">
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
