/** How close the reported usage limit is to its cap. */
export enum UsageLimitBannerSeverity {
  /** Running low: at or above the host's warning threshold, below 100%. Renders the warning variant. */
  Warning = 'warning',
  /** Exhausted: at or above 100%. Renders the error variant. */
  Reached = 'reached',
}

/** The already-formatted reset sentence shown after the limit sentence. */
export interface UsageLimitBannerReset {
  /** Machine-readable instant for the `<time dateTime>` attribute, e.g. `'2026-10-14T00:00:00Z'`. */
  isoValue: string;
  /** Visible, translated reset sentence, e.g. `'Resets at 3:00 AM GMT+3.'`. */
  label: string;
  /** Spoken form announced instead of `label`, e.g. with the zone named in full. When omitted, `label` is announced. */
  ariaLabel?: string;
}

/** Props for `UsageLimitBannerView`. */
export interface UsageLimitBannerViewProps {
  /** Severity of the reported limit; selects the warning or error variant. */
  severity: UsageLimitBannerSeverity;
  /** Translated limit sentence, rendered verbatim, e.g. `'Daily limit 80% used.'`. */
  limitText: string;
  /** Reset sentence rendered after `limitText`. Omitted when absent. */
  reset?: UsageLimitBannerReset;
  /** Called when the close button is activated. The close button renders only when this is supplied. */
  onClose?: () => void;
  /** Typography class applied to the limit sentence. Defaults to `'dial-body-semi-text'`. */
  limitTextClassName?: string;
  /** Typography class applied to the reset sentence. No default — it inherits the notification's message typography. */
  resetTextClassName?: string;
  /** Additional class applied to the banner root, alongside `dial-ci-usage-banner`. */
  className?: string;
}
