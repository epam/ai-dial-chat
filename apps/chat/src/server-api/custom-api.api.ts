import { customApiApi } from './api-client';

interface CustomApiEnvelope {
  readonly data: unknown;
}

const isCustomApiEnvelope = (value: unknown): value is CustomApiEnvelope =>
  typeof value === 'object' && value !== null && 'data' in value;

/**
 * Calls a deployment-configured custom Core API operation by its registry
 * ID (GET /api/v1/custom-api/:operationId). Decodes the response envelope
 * manually as `unknown` rather than trusting the generated client's
 * `CustomApiResponseDto.data` typing (`{ [key: string]: unknown }` — a
 * documented generator limitation, see libs/chat-api-client/README.md): the
 * real value may be any JSON value, including an array, string, number,
 * boolean, or null. The calling application owns validating and
 * interpreting this value for its own domain; this adapter performs no
 * business decoding, caching, retry, or query/body input — v1 supports
 * neither.
 */
export const callCustomApiOperation = async (
  id: string,
  signal?: AbortSignal,
): Promise<unknown> => {
  const apiResponse = await customApiApi.getCustomApiOperationRaw(
    { id },
    signal ? { signal } : undefined,
  );
  const envelope: unknown = await apiResponse.raw.json();

  if (!isCustomApiEnvelope(envelope)) {
    throw new Error('Custom API response did not contain a data envelope');
  }

  return envelope.data;
};
