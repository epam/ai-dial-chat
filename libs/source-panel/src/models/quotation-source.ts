/** A source document or attachment referenced in a conversation quotation. */
export interface QuotationSource {
  /** URL of the source resource. */
  url: string;
  /** Human-readable title of the source. */
  title: string;
  /** MIME type of the source attachment (e.g. `'application/pdf'`). */
  contentType: string;
  /** Excerpt from the source that was quoted. */
  quote?: string;
}
