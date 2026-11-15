import {
  type GetConversationsResponse,
  OverlayRequestType,
} from '@epam/ai-dial-chat-overlay';
import type {
  ActiveConversationBridge,
  ConversationListBridge,
} from '../bridges';
import {
  hasCreateConversationPayload,
  hasDeleteConversationPayload,
  hasRenameConversationPayload,
  hasStringPayload,
  hasTemperaturePayload,
} from './payload-guards';
import {
  type OverlayRequestRoute,
  type OverlayRequestTypeRoutedTo,
} from './request-routes';

/**
 * Executes one request against a bridge. Returns the response payload, or
 * `null` when the payload does not match the request's contract; may throw.
 */
export type BridgeRequestHandler<TBridge> = (
  bridge: TBridge,
  payload: unknown,
) => Promise<unknown> | null;

/** One handler per request type routed to the active-conversation bridge. */
export const ACTIVE_CONVERSATION_HANDLERS: Record<
  OverlayRequestTypeRoutedTo<OverlayRequestRoute.ActiveConversation>,
  BridgeRequestHandler<ActiveConversationBridge>
> = {
  [OverlayRequestType.GetMessages]: (bridge) =>
    Promise.resolve(bridge.getMessages()),
  [OverlayRequestType.SendMessage]: (bridge, payload) =>
    hasStringPayload(payload, 'content')
      ? bridge.sendMessage(payload.content)
      : null,
  [OverlayRequestType.SetInputContent]: (bridge, payload) => {
    if (!hasStringPayload(payload, 'content')) {
      return null;
    }
    bridge.setInputContent(payload.content);
    return Promise.resolve(undefined);
  },
  [OverlayRequestType.SetSystemPrompt]: (bridge, payload) =>
    hasStringPayload(payload, 'systemPrompt')
      ? bridge.setSystemPrompt(payload.systemPrompt)
      : null,
  [OverlayRequestType.SetTemperature]: (bridge, payload) =>
    hasTemperaturePayload(payload)
      ? bridge.setTemperature(payload.temperature)
      : null,
};

/** One handler per request type routed to the conversation-list bridge. */
export const CONVERSATION_LIST_HANDLERS: Record<
  OverlayRequestTypeRoutedTo<OverlayRequestRoute.ConversationList>,
  BridgeRequestHandler<ConversationListBridge>
> = {
  [OverlayRequestType.GetConversations]: (bridge) => {
    const responsePayload: GetConversationsResponse = {
      conversations: bridge.getConversations(),
    };
    return Promise.resolve(responsePayload);
  },
  [OverlayRequestType.CreateConversation]: (bridge, payload) =>
    hasCreateConversationPayload(payload)
      ? bridge.createConversation({
          deploymentId: payload?.deploymentId,
          firstMessage: payload?.firstMessage,
        })
      : null,
  [OverlayRequestType.CreateLocalConversation]: (bridge) =>
    bridge.createConversation({}),
  [OverlayRequestType.DeleteConversation]: (bridge, payload) =>
    hasDeleteConversationPayload(payload)
      ? bridge.deleteConversation(payload.id)
      : null,
  [OverlayRequestType.RenameConversation]: (bridge, payload) =>
    hasRenameConversationPayload(payload)
      ? bridge.renameConversation(payload.id, payload.newName)
      : null,
};
