import { OverlayFeature } from '@epam/ai-dial-chat-overlay';

/**
 * The 25 `OverlayFeature` keys enabled by default, reflecting today's
 * unconditional app behavior (see `design.md`'s classification table in the
 * `add-chat-overlay-enabled-features` change). Every other transferable key
 * ("modifier" keys) defaults off so a deployment that configures nothing
 * observes zero behavior change.
 *
 * `CatalogTableView` is listed but no longer gates anything: Browse opens in
 * list view unconditionally, because `Catalog`'s own `initialViewMode` default
 * is `CatalogViewMode.List`. Gating it here made the landing view depend on
 * `ENABLED_UI_FEATURES`, whose replace semantics silently dropped the list
 * default for any deployment that configured the variable at all. The key is
 * kept so an overlay host still sending it is not warned about an unknown
 * feature.
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
