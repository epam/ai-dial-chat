import type { CatalogContentNodeType } from '../types/catalog-content-node-type';
import type { CatalogContentPreviewType } from '../types/catalog-content-preview-type';
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

/** A selectable file in the Content tab's hierarchical file selector. */
export interface CatalogContentFileNode {
  /** Discriminates this node as a file. */
  type: CatalogContentNodeType.File;
  /** Opaque id passed back to `onLoadContentFile`. Never parsed by the panel. */
  id: string;
  /** File name shown in the tree row. Not required to be unique across the tree — only `id` must be unique among a node's siblings' descendants. */
  name: string;
}

/** A grouping folder in the Content tab's hierarchical file selector. */
export interface CatalogContentFolderNode {
  /** Discriminates this node as a folder. */
  type: CatalogContentNodeType.Folder;
  /** Stable key identifying this folder for expand/collapse state. Never parsed by the panel. */
  id: string;
  /** Folder name shown in the tree row. */
  name: string;
  /** Nested folders and files. Empty when the folder carries no children. */
  items: CatalogContentTreeNode[];
}

/** One node of the Content tab's hierarchical file tree — either a file or a folder. */
export type CatalogContentTreeNode =
  | CatalogContentFileNode
  | CatalogContentFolderNode;

/** A picked file's content, resolved and typed for safe read-only rendering. */
export interface CatalogContentMarkdownPreview {
  /** Discriminates this preview as Markdown. */
  type: CatalogContentPreviewType.Markdown;
  /** Markdown source, rendered through the same safe path as the base body. */
  text: string;
}

/** Plain or source-code text, rendered read-only with whitespace preserved. */
export interface CatalogContentTextPreview {
  /** Discriminates this preview as text. */
  type: CatalogContentPreviewType.Text;
  /** The file's text content. */
  text: string;
  /** Syntax-highlighting language id (e.g. `'python'`, `'json'`). Omitted renders as unhighlighted monospace text. */
  language?: string;
}

/** An image preview, already resolved to a browser-loadable URL. */
export interface CatalogContentImagePreview {
  /** Discriminates this preview as an image. */
  type: CatalogContentPreviewType.Image;
  /** Already-resolved, browser-loadable image URL. May be a `blob:` URL the host created for this preview. */
  url: string;
}

/** A file the panel cannot render — shown as an explicit, accessible state rather than garbled content. */
export interface CatalogContentUnsupportedPreview {
  /** Discriminates this preview as unsupported. */
  type: CatalogContentPreviewType.Unsupported;
}

/** A picked file's resolved preview — one of four generic, host-agnostic shapes. */
export type CatalogContentFilePreview =
  | CatalogContentMarkdownPreview
  | CatalogContentTextPreview
  | CatalogContentImagePreview
  | CatalogContentUnsupportedPreview;

/** Complete data for the Content tab (long-form text entities such as prompts). */
export interface CatalogItemPromptContent {
  /** The item's full text body, already resolved by the host. */
  content: string;
  /** Summary shown above the body. Takes precedence over `CatalogItem.description`, for hosts whose summary is only known once details resolve. */
  description?: string;
  /** Folder/file tree the tab can switch between. A selector is rendered above the body whenever this holds two or more file nodes, at any depth. */
  files?: CatalogContentTreeNode[];
  /** Id of the file `content` was resolved from. The selector opens on it, and reselecting it restores `content` without a reload. */
  selectedFileId?: string;
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
