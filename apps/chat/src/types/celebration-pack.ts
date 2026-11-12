/** The kind of event a celebration pack resolves for. */
export enum CelebrationPackTarget {
  /** A compiled event whose allowlisted scenes a pack may replace. */
  Known = 'known',
  /** An admitted event without a compiled module, described entirely by its pack. */
  External = 'external',
}
