/** Where the client takes celebration scenes from. */
export enum CelebrationDeliveryMode {
  /** Compiled scenes only; no celebration request is made. */
  Bundled = 'bundled',
  /** Allowlisted scenes and admitted events from external packs, compiled scenes otherwise. */
  PreferExternal = 'prefer-external',
}
