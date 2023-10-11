import {
  OverlayEvents,
  OverlayRequests,
} from '@/src/store/overlay/overlay.epics';

import { overlayAppName } from '@/src/constants/overlay';

export const isPostMessageOverlayRequest = (event: MessageEvent): boolean =>
  event.data?.type && // has type
  event.data?.requestId && // has requestId
  event.data?.type.startsWith(overlayAppName); // type starts with overlayAppName, that means messages come to overlay, we should handle it

export function sendPMResponse(
  type: OverlayRequests,
  requestId: string,
  hostDomain: string,
  payload: unknown,
) {
  window.parent.postMessage(
    {
      type: `${overlayAppName}/${type}/RESPONSE`,
      requestId,
      payload,
    },
    hostDomain,
  );
}

export function sendPMEvent(
  type: OverlayEvents,
  hostDomain: string,
  payload: unknown,
) {
  window.parent.postMessage(
    {
      type: `${overlayAppName}/${type}`,
      payload,
    },
    hostDomain,
  );
}
