/** Host-resolved presentation of one pending sign-in request. */
export interface SigninInterruptDialogRow {
  /** Pending event id passed back to every row callback. */
  id: string;
  /** Resource display name. */
  displayName: string;
  /** Resource version rendered in secondary text after the name, when present. */
  displayVersion?: string;
  /** Current value of the row's API key field. */
  apiKey: string;
  /** Whether a login or decline is in flight; disables the row's controls and shows a spinner on its login action. */
  isProcessing: boolean;
  /** Whether `Log in` is enabled while the row is idle. */
  canSubmitLogin: boolean;
  /** Whether to render the password-type API key field. */
  requiresApiKey: boolean;
  /** Whether the resource needs no credentials; replaces the actions with the no-credentials label. */
  requiresNoCredentials: boolean;
  /** Whether to render the DIAL-native offline-access hint. */
  showDialNativeHint: boolean;
  /** Translated recoverable error, rendered under the name while the row's login action reads Retry; omitted when the row has none. */
  errorMessage?: string;
}

/** Localizable copy of `SigninInterruptDialog`; omitted values use English defaults. */
export interface SigninInterruptDialogLabels {
  /** Dialog heading. Defaults to `'Sign-in required'`. */
  title?: string;
  /** Text under the heading. Defaults to `'One or more tools or services need you to sign in before the conversation can continue.'`. */
  description?: string;
  /** Footer action declining every row, shown while more than one row is listed. Defaults to `'Decline all'`. */
  declineAll?: string;
  /** Footer action that declines the only row and closes the dialog, shown while one row is listed. Defaults to `'Cancel'`. */
  cancel?: string;
  /** Footer action logging in to the next actionable row, given its name. Defaults to `` (name) => `Log in to ${name}` ``. */
  logInTo?: (name: string) => string;
  /** Accessible name of the per-row icon-only decline action. Defaults to `'Decline'`. */
  decline?: string;
  /** Per-row login action and its spinner's accessible name. Defaults to `'Log in'`. */
  logIn?: string;
  /** Per-row login action while the row shows an error. Defaults to `'Retry'`. */
  retry?: string;
  /** API key field label. Defaults to `'API key'`. */
  apiKeyLabel?: string;
  /** API key field placeholder. Defaults to `'Enter API key'`. */
  apiKeyPlaceholder?: string;
  /** DIAL-native row hint. Defaults to `'Connect your account for offline access. An administrator must separately approve this application's access.'`. */
  dialNativeHint?: string;
  /** Label of a row that needs no credentials. Defaults to `'No credentials required'`. */
  noCredentialsRequired?: string;
  /** Offline-use consent checkbox label. Defaults to `'Allow offline use'`. */
  offlineUsageConsent?: string;
  /** Offline-use consent checkbox caption. Defaults to `'Required for scheduled and background runs.'`. */
  offlineUsageConsentHint?: string;
}

/** Color overrides of `SigninInterruptDialog`, applied as `--cat-signin-*` custom properties. */
export interface SigninInterruptDialogColors {
  /** Row background on hover and while a row control has focus. Defaults to `--bg-control-neutral-hover-muted`. */
  rowHoverBackground?: string;
  /** Row name text. Defaults to `--text-primary`. */
  nameText?: string;
  /** Row error text and icon. Defaults to `--text-error`. */
  errorText?: string;
  /** Row version, DIAL-native hint and no-credentials label. Defaults to `--text-secondary`. */
  hintText?: string;
  /** Text under the heading. Defaults to `--text-secondary`. */
  descriptionText?: string;
}

/** Props of `SigninInterruptDialog`. */
export interface SigninInterruptDialogProps {
  /** Pending sign-in requests in display order; an empty list renders nothing. */
  rows: SigninInterruptDialogRow[];
  /** Status announced politely after a row resolves. Defaults to `''`. */
  statusMessage?: string;
  /** Whether to render the offline-use consent checkbox. Defaults to `false`. */
  isOfflineUsageConsentShown?: boolean;
  /** Checked state of the offline-use consent checkbox. */
  offlineUsageConsent: boolean;
  /** Called with the new offline-use consent. */
  onOfflineUsageConsentChange: (value: boolean) => void;
  /** Called with a row id and its new API key. */
  onApiKeyChange: (rowId: string, value: string) => void;
  /** Called with a row id on its `Log in` / Retry action, or with the first idle, submittable row needing credentials on the footer's `Log in to …`; must open any OAuth popup synchronously. */
  onLogin: (rowId: string) => void;
  /** Called with a row id on `Decline`. */
  onDecline: (rowId: string) => void;
  /** Called on the footer's `Decline all` (more than one row, shown with `Log in to …`) or `Cancel` (one row). */
  onDeclineAll: () => void;
  /** Copy overrides. */
  labels?: SigninInterruptDialogLabels;
  /** Color overrides. */
  colors?: SigninInterruptDialogColors;
  /** Typography class of the text under the heading. Defaults to `'dial-small-text'`. */
  descriptionClassName?: string;
  /** Typography class of each row name. Defaults to `'dial-body-semi-text'`. */
  nameClassName?: string;
  /** Typography class of each row error. Defaults to `'dial-small-text'`. */
  errorClassName?: string;
  /** Typography class of the row version, the DIAL-native hint and the no-credentials label. Defaults to `'dial-small-text'`. */
  hintClassName?: string;
}
