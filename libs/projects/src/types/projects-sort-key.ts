/** Order in which {@link Projects} lists the visible projects. */
export enum ProjectsSortKey {
  /** Most recently updated first; undated projects last. */
  Newest = 'newest',
  /** Least recently updated first; undated projects last. */
  Oldest = 'oldest',
  /** Alphabetical by name, locale-aware. */
  NameAsc = 'name-asc',
}
