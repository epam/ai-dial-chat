/** Tab identifiers for the entity details panel. */
export enum CatalogDetailsTab {
  /** Intro/description content (`item.intro ?? item.description`). Always the first tab. */
  About = 'about',
  Overview = 'overview',
  Pricing = 'pricing',
  Api = 'api',
  /** Tool definitions tab, shown for Toolset entities. */
  Tools = 'tools',
}
