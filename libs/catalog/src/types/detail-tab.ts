/** Tab identifiers for the entity details panel. */
export enum CatalogDetailsTab {
  /** Description content (`item.description`). Always the first tab. */
  About = 'about',
  Overview = 'overview',
  Pricing = 'pricing',
  /** Runtime usage-limit progress for model deployments. */
  Limits = 'limits',
  /** Resource ID, endpoint, and code snippets. Labeled "Connect". */
  Api = 'api',
  /** Tool definitions tab, shown for Toolset entities. */
  Tools = 'tools',
}
