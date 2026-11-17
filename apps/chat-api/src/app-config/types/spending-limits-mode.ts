/** The DIAL Core `spendingLimits.mode` the chat presents budgets for; the operator sets it to Core's value. */
export enum SpendingLimitsMode {
  /** Budgets are not shown; the role cost limit is presented as the account limit. */
  Off = 'off',
  /** Budgets are shown as not yet enforced; the role cost limit still decides. */
  Shadow = 'shadow',
  /** Budgets limit model calls; the role cost limit applies to application calls only. */
  Enforce = 'enforce',
}
