export { AttachmentCard } from './components/AttachmentCard/AttachmentCard';
export { AttachmentTray } from './components/AttachmentTray/AttachmentTray';
export { AttachmentGroup } from './components/AttachmentGroup/AttachmentGroup';
export { FileDndOverlay } from './components/FileDndOverlay/FileDndOverlay';

export type {
  AttachmentCardProps,
  AttachmentCardColors,
  AttachmentCardTypography,
  AttachmentCardStyles,
  AttachmentCardLabels,
  AttachmentCardState,
  AttachmentTypeLabels,
} from './models/attachment-card';
export type {
  AttachmentTrayProps,
  AttachmentTrayLabels,
  AttachmentTrayStyles,
} from './models/attachment-tray';
export {
  type AttachmentGroupProps,
  type AttachmentGroupLabels,
  type AttachmentGroupColors,
  type AttachmentGroupTypography,
  type AttachmentGroupStyles,
} from './models/attachment-group';
export type {
  FileDndOverlayProps,
  FileDndOverlayLabels,
  FileDndOverlayColors,
  FileDndOverlayTypography,
  FileDndOverlayStyles,
} from './models/file-dnd-overlay';
export type {
  FileAttachmentLabels,
  FileAttachmentTypography,
  FileAttachmentStyles,
} from './models/attachment-file-row';

export {
  useClipboardPaste,
  type UseClipboardPasteLabels,
} from './hooks/useClipboardPaste';
export {
  useLazyImageLoad,
  LazyImageLoadStatus,
} from './hooks/useLazyImageLoad';

export {
  generateAttachmentId,
  getAttachmentCardState,
  getExtFromContentType,
  getAttachmentIcon,
  getNameWithoutExtension,
  mimeTypesToExtensionLabels,
  isMimeTypeAllowed,
} from './utils/attachment';

export { ATTACHMENT_COLLAPSE_THRESHOLD } from './constants/attachment-group';
export { MAX_UPLOADS_PER_MINUTE } from './constants/upload';
