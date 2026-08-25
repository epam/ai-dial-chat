import type {
  CatalogItemApiDetails,
  EndpointOption,
} from '@epam/ai-dial-catalog';
import { CodeLanguage } from '@epam/ai-dial-catalog';
import { safeDecodeURIComponent } from './string-utils';

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

export const buildChatCompletionsUrl = (baseUrl: string, id: string): string =>
  `${trimTrailingSlash(baseUrl)}/openai/deployments/${encodeDeploymentPath(id)}/chat/completions`;

export const buildResponsesUrl = (baseUrl: string): string =>
  `${trimTrailingSlash(baseUrl)}/openai/v1/responses`;

export interface DeploymentGenerationApiSupport {
  hasChatCompletion?: boolean;
  hasResponsesApi?: boolean;
}

/**
 * Builds the "Connect" tab's endpoint list for a model or application
 * deployment: the OpenAI-compatible Chat Completions endpoint and/or the
 * Responses API endpoint, each included only when the deployment reports
 * supporting it. DIAL Core routes both APIs the same way for models and
 * custom applications, keyed by the deployment id.
 */
export const buildDeploymentConnectApi = (
  baseUrl: string,
  id: string,
  { hasChatCompletion, hasResponsesApi }: DeploymentGenerationApiSupport,
): CatalogItemApiDetails | undefined => {
  const endpoints: EndpointOption[] = [];

  if (hasChatCompletion) {
    const url = buildChatCompletionsUrl(baseUrl, id);
    endpoints.push({
      label: 'Chat Completions',
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
      label: 'Responses',
      url,
      snippets: [
        {
          language: CodeLanguage.Curl,
          code: `curl -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Api-Key: <key>' \\\n  -d '{"model":"${id}","input":"Hello"}'`,
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
