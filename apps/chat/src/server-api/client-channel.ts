import {
  ReportClientChannelDto,
  ReportClientChannelDtoResultEnum,
} from '@epam/ai-dial-chat-api-client';
import { JSON_HEADERS } from '../constants/http';
import { clientChannelApi } from './api-client';
import { ApiEndpoints, getCsrfToken, setCsrfToken } from './base';

export { ReportClientChannelDtoResultEnum as ClientChannelReportResult };

const CHANNEL_ID_HEADER = 'X-DIAL-CLIENT-CHANNEL-ID';

export interface ClientChannelSubscription {
  /** SSE response body — the caller owns reading and cancelling it. */
  body: ReadableStream<Uint8Array>;
  /** Channel id assigned or resumed by DIAL Core for this subscription. */
  channelId: string;
}

/**
 * Opens the client-channel SSE subscription with a raw `fetch` — the
 * generated client cannot stream a `ReadableStream` response body, so this
 * mirrors `chat-stream.api.ts`'s `streamCompletion` precedent instead of
 * going through `clientChannelApi`.
 */
export const subscribeClientChannel = async (
  reconnectChannelId: string | undefined,
  signal: AbortSignal,
): Promise<ClientChannelSubscription> => {
  const response = await fetch(`${ApiEndpoints.CLIENT_CHANNEL}/subscribe`, {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: {
      ...JSON_HEADERS,
      ...(getCsrfToken() != null
        ? { 'X-CSRF-Token': getCsrfToken() as string }
        : {}),
      ...(reconnectChannelId
        ? { [CHANNEL_ID_HEADER]: reconnectChannelId }
        : {}),
    },
  });

  const rotatedCsrf = response.headers.get('x-csrf-token');
  if (rotatedCsrf) setCsrfToken(rotatedCsrf);

  if (!response.ok || !response.body) {
    throw new Error(`subscribeClientChannel failed: ${response.status}`);
  }

  const channelId = response.headers.get(CHANNEL_ID_HEADER.toLowerCase());
  if (!channelId) {
    throw new Error('subscribeClientChannel response is missing channel id');
  }

  return { body: response.body, channelId };
};

export const reportClientChannel = (
  channelId: string,
  body: ReportClientChannelDto,
): Promise<void> =>
  clientChannelApi.reportClientChannel({
    xDialClientChannelId: channelId,
    reportClientChannelDto: body,
  });

export const unsubscribeClientChannel = (channelId: string): Promise<void> =>
  clientChannelApi.unsubscribeClientChannel({
    xDialClientChannelId: channelId,
  });
