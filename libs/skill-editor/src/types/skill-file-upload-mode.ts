/** What the upload dialog stages: device files as-is, or the entries of `.zip` archives. */
export enum SkillFileUploadMode {
  /** Every picked or dropped file is staged as one candidate. */
  Files = 'files',
  /** Every picked or dropped `.zip` is expanded through `fileActions.extractArchive` and its entries staged. */
  Archive = 'archive',
}
