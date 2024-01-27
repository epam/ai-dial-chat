import { OverlayEvents, OverlayRequests } from 'shared';

import { overlayAppName } from '@/src/constants/overlay';

export const isPostMessageOverlayRequest = (event: MessageEvent): boolean =>
  event.data?.type && // has type
  event.data?.requestId && // has requestId
  event.data?.type.startsWith(overlayAppName); // type starts with overlayAppName, that means messages come to overlay, we should handle it

interface PostMessageRequestParams {
  requestId: string;
  hostDomain: string;
  payload?: unknown;
}

export function sendPMResponse(
  type: OverlayRequests,
  requestParams: PostMessageRequestParams,
) {
  const { requestId, hostDomain, payload } = requestParams;
  window.parent.postMessage(
    {
      type: `${overlayAppName}/${type}/RESPONSE`,
      requestId,
      payload,
    },
    hostDomain,
  );
}

interface PostMessageEventParams {
  hostDomain: string;
  payload?: unknown;
}

export function sendPMEvent(
  type: OverlayEvents,
  eventParams: PostMessageEventParams,
) {
  const { hostDomain, payload } = eventParams;
  window.parent.postMessage(
    {
      type: `${overlayAppName}/${type}`,
      payload,
    },
    hostDomain,
  );
}
