export * from './lib/ChatOverlay';
export * from './lib/ChatOverlayManager';

export {
  Feature,
  type ChatOverlayOptions,
  type OverlayConversation,
  type SendMessageResponse,
  type SetSystemPromptResponse,
  type GetMessagesResponse,
  type GetConversationsResponse,
  type CreateConversationResponse,
  type SelectConversationResponse,
  type SelectedConversationLoadedResponse,
  type overlayAppName,
  OverlayEvents,

  // Conversation and messages specific exports
  type Role,
  type ImageMIMEType,
  type MIMEType,
  type Attachment,
  type StageStatus,
  type Stage,
  type LikeState,
  type MessageSettings,
  type ConversationEntityModel,
  type Message,
  type UploadStatus,
  type Entity,
  type PublishActions,
  type EntityPublicationInfo,
  type ShareInterface,
  type ShareEntity,
  type ConversationInfo,
  type TemplateMapping,
} from '@epam/ai-dial-shared';
