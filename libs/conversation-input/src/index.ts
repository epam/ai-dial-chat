export { ConversationInput } from './components/ConversationInput/ConversationInput';
export { BottomSheetShell } from './components/BottomSheetShell/BottomSheetShell';
export type { BottomSheetShellProps } from './components/BottomSheetShell/BottomSheetShell';
export { EditMessageInput } from './components/EditMessageInput/EditMessageInput';
export { Input } from './components/Input/Input';
export type {
  ConversationInputProps,
  ConversationInputColors,
  ConversationInputTypography,
  ConversationInputStyles,
  EditMessageInputProps,
} from './models/ConversationInput';
export type { InputProps, InputColors, InputTypography } from './models/Input';
export { SendOnEnter } from './models/Input';

// Re-exports from @epam/ai-dial-attachment-input for backwards compatibility
export {
  AttachmentCard,
  AttachmentTray,
  FileDndOverlay,
  getAttachmentIcon,
} from '@epam/ai-dial-attachment-input';
export type {
  AttachmentCardProps,
  AttachmentCardColors,
  AttachmentCardTypography,
  AttachmentTrayProps,
  FileDndOverlayProps,
} from '@epam/ai-dial-attachment-input';
