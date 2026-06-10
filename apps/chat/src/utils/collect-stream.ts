import { JSON_HEADERS } from '../constants/http';
import { ApiEndpoints, getCsrfToken, setCsrfToken } from '../server-api/base';

/**
 * POSTs to the completions SSE endpoint, accumulates `content` deltas from
 * each `data:` event, and resolves with the full concatenated string when the
 * stream closes or a `[DONE]` sentinel is received.
 *
 * Rejects on a non-2xx HTTP status or an SSE `error` event payload.
 */
export const collectStream = async (
  body: Record<string, unknown>,
): Promise<string> => {
  const response = await fetch(`${ApiEndpoints.CONVERSATIONS}/completions`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...JSON_HEADERS,
      ...(getCsrfToken() != null
        ? { 'X-CSRF-Token': getCsrfToken() as string }
        : {}),
    },
    body: JSON.stringify(body),
  });

  const rotatedCsrf = response.headers.get('x-csrf-token');
  if (rotatedCsrf) setCsrfToken(rotatedCsrf);

  if (!response.ok) {
    throw new Error(`Stream request failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        if (buffer.trim()) {
          accumulated += extractDelta(buffer);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        accumulated += extractDelta(line);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulated;
};

const extractDelta = (line: string): string => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data: ')) {
    return '';
  }

  const data = trimmed.slice(6);
  if (data === '[DONE]') return '';

  try {
    const parsed = JSON.parse(data) as {
      error?: { message: string };
      choices?: Array<{ delta?: { content?: string } }>;
    };
    if (parsed.error) {
      throw new Error(parsed.error.message);
    }
    return parsed.choices?.[0]?.delta?.content ?? '';
  } catch (err) {
    if (err instanceof SyntaxError) return '';
    throw err;
  }
};
