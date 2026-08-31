import { OverlayFeature } from '@epam/ai-dial-chat-overlay';

/**
 * The 25 `OverlayFeature` keys enabled by default, reflecting today's
 * unconditional app behavior (see `design.md`'s classification table in the
 * `add-chat-overlay-enabled-features` change). Every other transferable key
 * ("modifier" keys) defaults off so a deployment that configures nothing
 * observes zero behavior change.
 *
 * `CatalogTableView` is the exception to that rule: it is an initial-state
 * modifier that ships on, so Browse opens in list view. The grid default the
 * classification table recorded is not the view users expect to land on.
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
    OverlayFeature.ChatSettings,
    OverlayFeature.ConversationsSharing,
    OverlayFeature.ApplicationsSharing,
    OverlayFeature.ToolsetsSharing,
    OverlayFeature.ConversationsPublishing,
    OverlayFeature.SchemaApps,
    OverlayFeature.CodeApps,
    OverlayFeature.Catalog,
    OverlayFeature.CatalogTableView,
    OverlayFeature.FileManager,
    OverlayFeature.Toolsets,
    OverlayFeature.CustomApps,
    OverlayFeature.VoiceInput,
    OverlayFeature.Prompts,
    OverlayFeature.Skills,
  ],
);
