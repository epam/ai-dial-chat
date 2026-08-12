import { OverlayFeature } from '@epam/ai-dial-chat-overlay';

/**
 * The 20 `OverlayFeature` keys enabled by default, reflecting today's
 * unconditional app behavior (see `design.md`'s classification table in the
 * `add-chat-overlay-enabled-features` change). Every other transferable key
 * (13 "modifier" keys) defaults off so a deployment that configures nothing
 * observes zero behavior change.
 */
export const DEFAULT_ENABLED_UI_FEATURES: ReadonlySet<OverlayFeature> = new Set(
  [
    OverlayFeature.Header,
    OverlayFeature.ConversationsSection,
    OverlayFeature.ConversationsPanelToggle,
    OverlayFeature.ShowConversationsSectionByDefault,
    OverlayFeature.AttachmentsManager,
    OverlayFeature.Likes,
    OverlayFeature.DislikeComment,
    OverlayFeature.InputFiles,
    OverlayFeature.LiveChatInteraction,
    OverlayFeature.EmptyChatSettings,
    OverlayFeature.ConversationsSharing,
    OverlayFeature.ApplicationsSharing,
    OverlayFeature.ToolsetsSharing,
    OverlayFeature.ConversationsPublishing,
    OverlayFeature.CustomApplications,
    OverlayFeature.CodeApps,
    OverlayFeature.Catalog,
    OverlayFeature.Toolsets,
    OverlayFeature.CustomApps,
    OverlayFeature.VoiceInput,
    OverlayFeature.Prompts,
  ],
);
