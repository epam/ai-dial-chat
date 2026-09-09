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
