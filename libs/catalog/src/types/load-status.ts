/** Where the data behind a `CatalogPickerModal` stands. */
export enum CatalogLoadStatus {
  /** The items are still being fetched; the picker shows a spinner. */
  Loading = 'loading',
  /** The items are in; the picker lists them. */
  Ready = 'ready',
  /** The items failed to load; the picker shows the error, with Retry when `onRetry` is given. */
  Error = 'error',
}
