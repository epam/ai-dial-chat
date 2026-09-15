/** A single favorited skill as shown in {@link FavoriteSkillsPanelProps}. */
export interface FavoriteSkillItem {
  /**
   * Stable identifier for the skill: the `skills/{bucket}/{path}` resource
   * URL, identical to the skill's `CatalogItem` id.
   */
  id: string;
  /** Display name. */
  name: string;
  /** Listing-sourced description shown in a tooltip on hover. Omitted when empty. */
  description?: string;
}

/**
 * The listing-entry fields needed to build a favorite row — satisfied by the
 * host's skill listing DTO or any `{ url, name }` object.
 */
export interface SkillListingEntry {
  /** Stable identifier for the skill: the `skills/{bucket}/{path}` resource URL. */
  url: string;
  /** Display name. */
  name: string;
  /** Listing-sourced description (Core PR #1970). Absent on folders and older Cores. */
  description?: string;
}

/**
 * Builds a {@link FavoriteSkillItem} from a listing entry, mapping its
 * description straight through — the listing is the description's only
 * source, so an entry that carries none yields no description paragraph.
 */
export const buildFavoriteSkillItem = (
  skill: SkillListingEntry,
): FavoriteSkillItem => ({
  id: skill.url,
  name: skill.name,
  description: skill.description,
});
