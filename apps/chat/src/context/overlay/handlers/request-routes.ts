import { OverlayRequestType } from '@epam/ai-dial-chat-overlay';

/** Which part of `OverlayProvider` handles an overlay request type. */
export enum OverlayRequestRoute {
  /** The `SET_OVERLAY_OPTIONS` handshake; checked against the origin allowlist. */
  HostOptions = 'hostOptions',
  /** Answered by the registered `ActiveConversationBridge`. */
  ActiveConversation = 'activeConversation',
  /** Answered by the registered `ConversationListBridge`. */
  ConversationList = 'conversationList',
  /** Answered from the tracked current conversation, without a bridge call. */
  SelectedConversations = 'selectedConversations',
  /** Navigates through the list bridge, then answers once the target registers as active. */
  ConversationSelection = 'conversationSelection',
}

/*
 * One entry per request type, so a new `OverlayRequestType` does not compile
 * until it is routed; routing it to a bridge then requires a handler in that
 * bridge's table.
 */
export const OVERLAY_REQUEST_ROUTES = {
  [OverlayRequestType.SetOverlayOptions]: OverlayRequestRoute.HostOptions,
  [OverlayRequestType.GetMessages]: OverlayRequestRoute.ActiveConversation,
  [OverlayRequestType.SendMessage]: OverlayRequestRoute.ActiveConversation,
  [OverlayRequestType.SetInputContent]: OverlayRequestRoute.ActiveConversation,
  [OverlayRequestType.SetSystemPrompt]: OverlayRequestRoute.ActiveConversation,
  [OverlayRequestType.SetTemperature]: OverlayRequestRoute.ActiveConversation,
  [OverlayRequestType.GetConversations]: OverlayRequestRoute.ConversationList,
  [OverlayRequestType.CreateConversation]: OverlayRequestRoute.ConversationList,
  [OverlayRequestType.CreateLocalConversation]:
    OverlayRequestRoute.ConversationList,
  [OverlayRequestType.DeleteConversation]: OverlayRequestRoute.ConversationList,
  [OverlayRequestType.RenameConversation]: OverlayRequestRoute.ConversationList,
  [OverlayRequestType.GetSelectedConversations]:
    OverlayRequestRoute.SelectedConversations,
  [OverlayRequestType.SelectConversation]:
    OverlayRequestRoute.ConversationSelection,
} as const satisfies Record<OverlayRequestType, OverlayRequestRoute>;

type Routes = typeof OVERLAY_REQUEST_ROUTES;

/** The request types `OVERLAY_REQUEST_ROUTES` sends to `TRoute`. */
export type OverlayRequestTypeRoutedTo<TRoute extends OverlayRequestRoute> = {
  [T in keyof Routes]: Routes[T] extends TRoute ? T : never;
}[keyof Routes];

/** Route of a request whose `type` passed `isOverlayMessageRequest`. */
export const getOverlayRequestRoute = (type: string): OverlayRequestRoute =>
  OVERLAY_REQUEST_ROUTES[type as OverlayRequestType];
