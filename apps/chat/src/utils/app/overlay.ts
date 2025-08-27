import {
  Message,
  OverlayEvents,
  OverlayRequests,
  Role,
  overlayAppName,
} from '@epam/ai-dial-shared';

export const isPostMessageOverlayRequest = (event: MessageEvent): boolean =>
  event.data?.type && // has type
  event.data?.requestId && // has requestId
  event.data?.type.startsWith(overlayAppName); // type starts with overlayAppName, that means messages come to overlay, we should handle it

export interface PostMessageRequestParams<T = unknown> {
  requestId: string;
  hostDomain: string;
  payload?: T;
}

export function sendPMResponse(
  type: OverlayRequests,
  requestParams: PostMessageRequestParams,
) {
  if (typeof window === 'undefined') return;
  const { requestId, hostDomain, payload } = requestParams;
  window?.parent.postMessage(
    {
      type: `${overlayAppName}/${type}/RESPONSE`,
      requestId,
      payload,
    },
    hostDomain,
  );
}

export interface PostMessageEventParams {
  hostDomain: string;
  payload?: unknown;
}

export function sendPMEvent(
  type: OverlayEvents,
  eventParams: PostMessageEventParams,
) {
  if (typeof window === 'undefined') return;

  const { hostDomain, payload } = eventParams;
  window?.parent.postMessage(
    {
      type: `${overlayAppName}/${type}`,
      payload,
    },
    hostDomain,
  );
}

export function updateSystemPromptInMessages(
  messages: Message[],
  overlaySystemPrompt: string,
) {
  const overlaySystemPromptMessage: Message = {
    content: overlaySystemPrompt,
    role: Role.System,
  };

  const systemMessageIndex = messages.findIndex(
    (message) => message.role === Role.System,
  );

  if (systemMessageIndex === -1) {
    return [overlaySystemPromptMessage, ...messages];
  }

  const resultMessages = [...messages];

  resultMessages[systemMessageIndex] = overlaySystemPromptMessage;

  return resultMessages;
}
