import type {
  CatalogItemApiDetails,
  EndpointOption,
} from '@epam/ai-dial-catalog';
import { CodeLanguage } from '@epam/ai-dial-catalog';
import { safeDecodeURIComponent } from '../shared/string-utils';

const trimTrailingSlash = (baseUrl: string): string =>
  baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

/*
 * `id` may already be percent-encoded (deployment ids can carry spaces and
 * other reserved characters), so each path segment is decoded first to avoid
 * double-encoding it; `/` stays a literal separator rather than becoming
 * `%2F`.
 */
const encodeDeploymentPath = (id: string): string =>
  id
    .split('/')
    .map((segment) => encodeURIComponent(safeDecodeURIComponent(segment)))
    .join('/');

/** Decodes a deployment id per path segment for display, e.g. in the Connect tab's "Model ID" row — `applications/public/qa%202.0` reads as `applications/public/qa 2.0`. */
const decodeDeploymentPathForDisplay = (id: string): string =>
  id.split('/').map(safeDecodeURIComponent).join('/');

/** Builds the OpenAI-compatible Chat Completions endpoint URL for a deployment. */
export const buildChatCompletionsUrl = (baseUrl: string, id: string): string =>
  `${trimTrailingSlash(baseUrl)}/openai/deployments/${encodeDeploymentPath(id)}/chat/completions`;

/** Builds the Responses API endpoint URL for a deployment. */
export const buildResponsesUrl = (baseUrl: string): string =>
  `${trimTrailingSlash(baseUrl)}/openai/v1/responses`;

/** Builds the Anthropic Messages endpoint URL. */
export const buildAnthropicMessagesUrl = (baseUrl: string): string =>
  `${trimTrailingSlash(baseUrl)}/anthropic/v1/messages`;

const quoteShellArgument = (value: string): string =>
  "'" + value.replaceAll("'", "'\\''") + "'";

/** Display labels for a deployment's generation APIs. */
export interface DeploymentConnectLabels {
  /** Chat Completions option. Defaults to 'Chat Completions'. */
  chatCompletions: string;
  /** Responses option. Defaults to 'Responses'. */
  responses: string;
  /** Anthropic Messages option. Defaults to 'Anthropic Messages'. */
  anthropicMessages: string;
}

/** English generation API option labels. */
export const DEFAULT_DEPLOYMENT_CONNECT_LABELS: DeploymentConnectLabels = {
  chatCompletions: 'Chat Completions',
  responses: 'Responses',
  anthropicMessages: 'Anthropic Messages',
};

/** Which generation APIs a deployment reports supporting. */
export interface DeploymentGenerationApiSupport {
  /** Whether Chat Completions is supported. */
  hasChatCompletion?: boolean;
  /** Whether Responses is supported. */
  hasResponsesApi?: boolean;
  /** Whether Anthropic Messages is supported. */
  hasAnthropicMessages?: boolean;
}

/** Returns Connect endpoint entries for the generation APIs a deployment supports. */
export const buildDeploymentConnectApi = (
  baseUrl: string,
  id: string,
  {
    hasChatCompletion,
    hasResponsesApi,
    hasAnthropicMessages,
  }: DeploymentGenerationApiSupport,
  labels?: Partial<DeploymentConnectLabels>,
): CatalogItemApiDetails | undefined => {
  const endpoints: EndpointOption[] = [];
  const texts: DeploymentConnectLabels = {
    chatCompletions:
      labels?.chatCompletions ??
      DEFAULT_DEPLOYMENT_CONNECT_LABELS.chatCompletions,
    responses: labels?.responses ?? DEFAULT_DEPLOYMENT_CONNECT_LABELS.responses,
    anthropicMessages:
      labels?.anthropicMessages ??
      DEFAULT_DEPLOYMENT_CONNECT_LABELS.anthropicMessages,
  };

  if (hasChatCompletion) {
    const url = buildChatCompletionsUrl(baseUrl, id);
    endpoints.push({
      label: texts.chatCompletions,
      url,
      snippets: [
        {
          language: CodeLanguage.Curl,
          code: `curl -X POST '${url}?api-version=<api-version>' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Api-Key: <key>' \\\n  -d '{"messages":[{"role":"user","content":"Hello"}]}'`,
        },
      ],
    });
  }

  if (hasResponsesApi) {
    const url = buildResponsesUrl(baseUrl);
    endpoints.push({
      label: texts.responses,
      url,
      snippets: [
        {
          language: CodeLanguage.Curl,
          code: `curl -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Api-Key: <key>' \\\n  -d '{"model":"${id}","input":"Hello"}'`,
        },
      ],
    });
  }

  if (hasAnthropicMessages) {
    const url = buildAnthropicMessagesUrl(baseUrl);
    const body = JSON.stringify({
      model: id,
      max_tokens: 128,
      messages: [{ role: 'user', content: 'Hello' }],
    });
    endpoints.push({
      label: texts.anthropicMessages,
      url,
      snippets: [
        {
          language: CodeLanguage.Curl,
          code: [
            `curl -X POST ${quoteShellArgument(url)} \\`,
            "  -H 'Content-Type: application/json' \\",
            "  -H 'Api-Key: <key>' \\",
            "  -H 'anthropic-version: 2023-06-01' \\",
            `  -d ${quoteShellArgument(body)}`,
          ].join('\n'),
        },
      ],
    });
  }

  if (endpoints.length === 0) return undefined;

  return {
    resource: { modelId: decodeDeploymentPathForDisplay(id) },
    endpoints,
  };
};
