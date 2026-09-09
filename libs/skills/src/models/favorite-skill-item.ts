/** A single favorited skill as shown in {@link FavoriteSkillsPanelProps}. */
export interface FavoriteSkillItem {
  /**
   * Stable identifier for the skill: the `skills/{bucket}/{path}` resource
   * URL, identical to the skill's `CatalogItem` id.
   */
  id: string;
  /** Display name. */
  name: string;
  /** Short description shown in a tooltip on hover. Omitted when empty. */
  description?: string;
  /**
   * Whether the description is still being resolved by the host. While
   * `true` the tooltip shows a spinner in the description's place.
   */
  isDescriptionLoading?: boolean;
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
}

/**
 * Builds a {@link FavoriteSkillItem} from a listing entry and the host's
 * resolved description cache. A cached `null` (no description or a failed
 * fetch) and a not-yet-fetched id both yield no description paragraph; ids
 * in `pendingIds` are marked as loading so the row's tooltip shows a spinner.
 */
export const buildFavoriteSkillItem = (
  skill: SkillListingEntry,
  descriptions: ReadonlyMap<string, string | null>,
  pendingIds: ReadonlySet<string>,
): FavoriteSkillItem => ({
  id: skill.url,
  name: skill.name,
  description: descriptions.get(skill.url) ?? undefined,
  isDescriptionLoading: pendingIds.has(skill.url),
});
