/** A model entry as returned by the DIAL Core `/v1/models` endpoint. */
export interface DialModel {
  /** Unique model identifier used in API calls. */
  id: string;
  /** Discriminator — always `'model'`. */
  object: string;
  /** Unix timestamp (s) when the model was created. */
  created?: number;
  /** Identifier of the model owner/provider. */
  owned_by?: string;
  /** Index signature for additional provider-specific fields. */
  [key: string]: unknown;
}

/** Response envelope for the DIAL Core model-listing endpoint. */
export interface DialModelListResponse {
  /** List of available models. */
  data: DialModel[];
}
