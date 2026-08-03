/**
 * The set of recognized `OverlayFeature` wire values, duplicated here rather
 * than imported from the browser-facing overlay package, keeping this
 * Node-only service independent of the frontend SDK.
 * Keep this list in sync with `OverlayFeature`
 * (`libs/chat-overlay/src/protocol/overlay-protocol.ts`) — its own test
 * suite asserts it has exactly 38 members, matching the count here.
 */
export const KNOWN_UI_FEATURES: ReadonlySet<string> = new Set([
  'code-apps',
  'custom-applications',
  'hide-custom-app-creation',
  'chat-header-border',
  'chat-input-border',
  'disabled-send',
  'skip-focus-chat-input-onload',
  'dislike-comment',
  'input-files',
  'likes',
  'live-chat-interaction',
  'disallow-change-agent',
  'hide-new-conversation',
  'top-chat-model-settings',
  'top-settings',
  'empty-chat-settings',
  'hide-empty-chat-change-agent',
  'attachments-manager',
  'conversations-panel-toggle',
  'conversations-section',
  'header',
  'showConversationsSectionByDefault',
  'show-layout-dividers',
  'marketplace',
  'marketplace-hide-my-apps',
  'marketplace-table-view',
  'hide-delete-user-message',
  'hide-edit-user-message',
  'hide-regenerate-assistant-message',
  'conversations-publishing',
  'applications-sharing',
  'conversations-sharing',
  'toolsets-sharing',
  'toolsets',
  'custom-logo',
  'hide-user-menu',
  'hide-user-settings',
  'voice-input',
]);
