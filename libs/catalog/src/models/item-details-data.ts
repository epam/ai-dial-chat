import type { CodeLanguage } from '../types/code-language';
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
  /** Full base endpoint URL. */
  endpointUrl?: string;
}

/** Complete data for the API details tab. */
export interface CatalogItemApiDetails {
  /** Resource identity section (Model ID, endpoint URL). */
  resource?: ApiResource;
  /** Code snippets selectable by language. */
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

/**
 * All tab-specific detail data for a catalog item.
 * A tab is shown only when its corresponding field is non-null.
 */
export interface CatalogItemTabData {
  /** Overview tab data. When absent the Overview tab is hidden. */
  overview?: CatalogItemOverview;
  /** Pricing tab data. When absent the Pricing tab is hidden. */
  pricing?: CatalogItemPricing;
  /** API tab data. When absent the API tab is hidden. */
  api?: CatalogItemApiDetails;
  /** Tools tab data (Toolset only). When absent the Tools tab is hidden. */
  tools?: CatalogItemTools;
}
