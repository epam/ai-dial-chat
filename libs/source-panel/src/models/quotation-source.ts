export interface QuotationSource {
  url: string;
  title: string;
  /** MIME type of the source attachment (e.g. `'application/pdf'`). */
  contentType: string;
  quote?: string;
}
