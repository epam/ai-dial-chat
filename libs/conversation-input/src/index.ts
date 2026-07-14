export { BottomSheetShell } from './components/BottomSheetShell/BottomSheetShell';
export type { BottomSheetShellProps } from './components/BottomSheetShell/BottomSheetShell';
export { ConversationInput } from './components/ConversationInput/ConversationInput';
export { EditMessageInput } from './components/EditMessageInput/EditMessageInput';
export { Input } from './components/Input/Input';
export type {
  ConversationInputColors,
  ConversationInputProps,
  ConversationInputStyles,
  ConversationInputTypography,
  EditMessageInputProps,
} from './models/ConversationInput';
export { SendOnEnter } from './models/Input';
export type {
  ChatSettingsValues,
  InputColors,
  InputProps,
  InputTypography,
} from './models/Input';

// Re-exports from @epam/ai-dial-attachment-input for backwards compatibility
export {
  AttachmentCard,
  AttachmentTray,
  AttachmentGroup,
  FileDndOverlay,
  getAttachmentIcon,
} from '@epam/ai-dial-attachment-input';
export type { AttachmentGroupProps } from '@epam/ai-dial-attachment-input';
export type { BottomSheetItem } from './components/BottomSheet/BottomSheet';
export {
  ChatSettingsModal,
  type ChatSettingsModalProps,
} from './components/ChatSettingsModal/ChatSettingsModal';
