/**
 * The set of recognized UI feature wire values, duplicated here rather than
 * imported from the browser-facing overlay package, keeping this Node-only
 * service independent of the frontend SDK.
 * The members mirror `OverlayFeature` one-to-one, in the enum's declaration
 * order; the companion test asserts exactly 37 members. Anything the frontend
 * would drop is rejected here instead, so an operator sees the warning at the
 * layer that read the env var. Keep this list in sync whenever a key is added
 * to, removed from, or renamed in `OverlayFeature`.
 */
export const KNOWN_UI_FEATURES: ReadonlySet<string> = new Set([
  'code-apps',
  'custom-applications',
  'hide-custom-app-creation',
  'disabled-send',
  'skip-focus-chat-input-onload',
  'dislike-comment',
  'input-files',
  'likes',
  'live-chat-interaction',
  'disallow-change-agent',
  'hide-change-agent',
  'hide-new-conversation',
  'empty-chat-settings',
  'hide-empty-chat-change-agent',
  'attachments-manager',
  'conversations-panel-toggle',
  'conversations-section',
  'header',
  'showConversationsSectionByDefault',
  'catalog',
  'catalog-hide-my-apps',
  'catalog-table-view',
  'file-manager',
  'hide-delete-user-message',
  'hide-edit-user-message',
  'hide-regenerate-assistant-message',
  'conversations-publishing',
  'applications-sharing',
  'conversations-sharing',
  'toolsets-sharing',
  'toolsets',
  'prompts',
  'skills',
  'custom-apps',
  'hide-user-menu',
  'hide-user-settings',
  'voice-input',
]);
