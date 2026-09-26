/** A skill mention's location within the current plain-text draft. */
export interface SkillMentionAnchor {
  /** The mentioned skill's resource URL — the value sent as this entry's `{ url }`. */
  url: string;
  /** Display name at the time of insertion (`/${name}` is what actually sits in the text). */
  name: string;
  /** Character offset of the leading `/` in the current draft string. */
  start: number;
  /** Length of the `/{name}` run, `1 + name.length`. */
  length: number;
}
