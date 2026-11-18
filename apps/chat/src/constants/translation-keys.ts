/*
 * Translation keys, one string enum per feature namespace of `en.json`.
 *
 * Each enum lives in its own module under `i18n-keys/` so the bundler keeps
 * only the namespaces a chunk uses: the entry chunk no longer carries the keys
 * of lazy pages such as the scheduled-task and skill editors. Import from this
 * file as before; add a new namespace as a module there and re-export it here.
 */
export { AnnouncementBannerI18nKeys } from './i18n-keys/announcement-banner';
export { AnnouncementsPopoverI18nKeys } from './i18n-keys/announcements-popover';
export { ApiI18nKeys } from './i18n-keys/api';
export { AppUpdateI18nKeys } from './i18n-keys/app-update';
export { ApplicationCredentialsI18nKeys } from './i18n-keys/application-credentials';
export { ApplicationEditorI18nKeys } from './i18n-keys/application-editor';
export { AppsEditorI18nKeys } from './i18n-keys/apps-editor';
export { AttachmentCanvasI18nKeys } from './i18n-keys/attachment-canvas';
export { AttachmentsI18nKeys } from './i18n-keys/attachments';
export { AuthI18nKeys } from './i18n-keys/auth';
export { BasicI18nKeys } from './i18n-keys/basic';
export { ButtonsI18nKeys } from './i18n-keys/buttons';
export { CatalogI18nKeys } from './i18n-keys/catalog';
export { ChatI18nKeys } from './i18n-keys/chat';
export { ChatSettingsI18nKeys } from './i18n-keys/chat-settings';
export { CitationsI18nKeys } from './i18n-keys/citations';
export { ConversationI18nKeys } from './i18n-keys/conversation';
export { ConversationExportI18nKeys } from './i18n-keys/conversation-export';
export { ConversationImportI18nKeys } from './i18n-keys/conversation-import';
export { ConversationInputI18nKeys } from './i18n-keys/conversation-input';
export { ConversationInputUsageBannerI18nKeys } from './i18n-keys/conversation-input-usage-banner';
export { ConversationPanelI18nKeys } from './i18n-keys/conversation-panel';
export { ConversationPublishI18nKeys } from './i18n-keys/conversation-publish';
export { ConversationUnpublishI18nKeys } from './i18n-keys/conversation-unpublish';
export { CustomAppI18nKeys } from './i18n-keys/custom-app';
export { CustomViewerI18nKeys } from './i18n-keys/custom-viewer';
export { DeploymentSelectorI18nKeys } from './i18n-keys/deployment-selector';
export { DialFileManagerI18nKeys } from './i18n-keys/dial-file-manager';
export { EditorI18nKeys } from './i18n-keys/editor';
export { EntityNotificationsI18nKeys } from './i18n-keys/entity-notifications';
export { ErrorBoundaryI18nKeys } from './i18n-keys/error-boundary';
export { ExtensionsI18nKeys } from './i18n-keys/extensions';
export { FavoritesI18nKeys } from './i18n-keys/favorites';
export { FileDndI18nKeys } from './i18n-keys/file-dnd';
export { FooterMessageI18nKeys } from './i18n-keys/footer-message';
export { HalloweenI18nKeys } from './i18n-keys/halloween';
export { NavigationI18nKeys } from './i18n-keys/navigation';
export { NewYearI18nKeys } from './i18n-keys/new-year';
export { NotFoundI18nKeys } from './i18n-keys/not-found';
export { NotificationI18nKeys } from './i18n-keys/notification';
export { OnboardingTourI18nKeys } from './i18n-keys/onboarding-tour';
export { ProjectsI18nKeys } from './i18n-keys/projects';
export { PromptEditorI18nKeys } from './i18n-keys/prompt-editor';
export { PromptSelectorI18nKeys } from './i18n-keys/prompt-selector';
export { PublishI18nKeys } from './i18n-keys/publish';
export { PublishAccessRulesI18nKeys } from './i18n-keys/publish-access-rules';
export { RateI18nKeys } from './i18n-keys/rate';
export { ResourceSavePanelI18nKeys } from './i18n-keys/resource-save-panel';
export { ScheduledTasksI18nKeys } from './i18n-keys/scheduled-tasks';
export { SettingsI18nKeys } from './i18n-keys/settings';
export { ShareI18nKeys } from './i18n-keys/share';
export { SidebarI18nKeys } from './i18n-keys/sidebar';
export { SkillArchiveImportI18nKeys } from './i18n-keys/skill-archive-import';
export { SkillEditorI18nKeys } from './i18n-keys/skill-editor';
export { SkillSelectorI18nKeys } from './i18n-keys/skill-selector';
export { TextRefinementI18nKeys } from './i18n-keys/text-refinement';
export { ToolsI18nKeys } from './i18n-keys/tools';
export { ToolsetEditorI18nKeys } from './i18n-keys/toolset-editor';
export { ToolsetSigninI18nKeys } from './i18n-keys/toolset-signin';
export { UnsavedChangesI18nKeys } from './i18n-keys/unsaved-changes';
export { UrlPreselectionI18nKeys } from './i18n-keys/url-preselection';
export { UsageI18nKeys } from './i18n-keys/usage';
export { UserConfigI18nKeys } from './i18n-keys/user-config';
export { VoiceRecordingI18nKeys } from './i18n-keys/voice-recording';
