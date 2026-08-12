import type { CodeLanguage } from '../types/code-language';
import type { CatalogItemCredentials } from './catalog-item-credentials';
import type { CatalogItemOverview } from './item-overview';

/** A code snippet for one programming language in the API tab. */
export interface CodeSnippet {
  /** Language selector label. */
  language: CodeLanguage;
  /** The code string, preserving whitespace and indentation. */
  code: string;
}

/** Resource identity rows shown in the API tab. */
export interface ApiResource {
  /** Deployment or model ID used in API calls. */
  modelId?: string;
  /** Full base endpoint URL (used for single-endpoint entities such as Agents). */
  endpointUrl?: string;
}

/** A named endpoint with its own URL and optional per-language code snippets. */
export interface EndpointOption {
  /** Display label shown in the endpoint selector, e.g. `'Azure OpenAI Endpoint'`. */
  label: string;
  /** Full base URL for this endpoint. */
  url: string;
  /** Language-keyed code snippets specific to this endpoint. */
  snippets?: CodeSnippet[];
}

/** Complete data for the API details tab. */
export interface CatalogItemApiDetails {
  /** Resource identity section (Model ID; single endpoint URL for agents). */
  resource?: ApiResource;
  /** Multi-endpoint selector (Azure OpenAI, Anthropic, Responses, …). When present, the endpoint selector UI replaces the single-endpoint row. */
  endpoints?: EndpointOption[];
  /** Top-level code snippets selectable by language (legacy / non-model entities). */
  snippets?: CodeSnippet[];
  /** Raw cURL request example (Agent / Toolset). */
  requestExample?: string;
  /** Response schema shown as formatted JSON (Agent). */
  responseSchema?: string;
}

/** A single price row in the Pricing tab. */
export interface PricingRow {
  /** Row label, e.g. "Input tokens". */
  label: string;
  /** Formatted price string, e.g. "Free" or "$3.00 / 1M". */
  price: string;
}

/** A single usage-limit row in the Pricing tab. */
export interface UsageLimitRow {
  /** Row label, e.g. "Daily limit". */
  label: string;
  /** Formatted limit value, e.g. "500K tokens / user". */
  value: string;
}

/** A single progress row in the Limits tab. */
export interface UsageLimitProgressRow {
  /** Row label, e.g. "Tokens per day". */
  label: string;
  /** Consumed amount for the limit period. */
  used: number;
  /** Total allowed amount for the limit period. Ignored when `isUnlimited` is true. */
  total: number;
  /** Whether the backend reports this row as effectively unlimited. */
  isUnlimited?: boolean;
  /** Preformatted visible value, e.g. "1,200 / 5,000". */
  valueLabel?: string;
  /** Accessible label for the progress bar. */
  ariaLabel?: string;
}

/** Complete data for the Limits tab. */
export interface CatalogItemLimits {
  /** Ordered progress rows to render. */
  rows: UsageLimitProgressRow[];
}

/** Complete data for the Pricing tab. */
export interface CatalogItemPricing {
  /** Token price rows (input, output, cached, batch). */
  prices?: PricingRow[];
  /** Usage limit rows (daily, weekly, monthly). */
  limits?: UsageLimitRow[];
}

/** A single input parameter for a tool. */
export interface ToolInputParam {
  /** Parameter name. */
  name: string;
  /** JSON type, e.g. "string" or "integer". */
  type: string;
  /** Whether the parameter is required. */
  isRequired: boolean;
}

/** A key-value annotation on a tool definition. */
export interface ToolAnnotation {
  /** Annotation key. */
  key: string;
  /** Annotation value. */
  value: string;
}

/** A single tool exposed by a Toolset. */
export interface ToolDefinition {
  /** Tool name. */
  name: string;
  /** Short description of what the tool does. */
  description?: string;
  /** Input schema parameters. */
  inputParams?: ToolInputParam[];
  /** Tool annotations. */
  annotations?: ToolAnnotation[];
}

/** Complete data for the Tools tab (Toolset entities only). */
export interface CatalogItemTools {
  /** Ordered list of tool definitions. */
  tools: ToolDefinition[];
}

/** Complete data for the Content tab (long-form text entities such as prompts). */
export interface CatalogItemPromptContent {
  /** The item's full text body, already resolved by the host. */
  content: string;
}

/**
 * All tab-specific detail data for a catalog item.
 * A tab is shown only when its corresponding field is non-null.
 */
export interface CatalogItemTabData {
  /** Content tab data. When absent the Content tab is hidden. */
  promptContent?: CatalogItemPromptContent;
  /** Overview tab data. When absent the Overview tab is hidden. */
  overview?: CatalogItemOverview;
  /** Pricing tab data. When absent the Pricing tab is hidden. */
  pricing?: CatalogItemPricing;
  /** Usage limits tab data. When absent the Limits tab is hidden. */
  limits?: CatalogItemLimits;
  /** API tab data. When absent the API tab is hidden. */
  api?: CatalogItemApiDetails;
  /** Tools tab data (Toolset only). When absent the Tools tab is hidden. */
  tools?: CatalogItemTools;
}

/**
 * Result returned by `onFetchDetails`: tab data plus the item's refreshed
 * credential status, so the details panel can update sign-in state after a
 * login/logout without a separate fetch path.
 */
export interface CatalogItemDetailsFetchResult extends CatalogItemTabData {
  /** Credential status for the item's own authentication, refreshed alongside tab data. */
  credentials?: CatalogItemCredentials;
}
