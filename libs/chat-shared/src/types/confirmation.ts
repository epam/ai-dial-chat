/** Palette a confirmation step is rendered with. */
export enum ConfirmationVariant {
  /** Irreversible loss for everyone — red identity card and a danger confirm button. */
  Danger = 'danger',
  /** Affects only the current user and is recoverable — blue identity card and a neutral confirm button. */
  Info = 'info',
}
