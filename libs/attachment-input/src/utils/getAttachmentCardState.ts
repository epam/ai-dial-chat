import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentType,
  MIME_TYPE_EXT_MAP,
  RequestStatus,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import type { Icon } from '@tabler/icons-react';
import { IconClipboard, IconPhoto, IconTerminal2 } from '@tabler/icons-react';
import styles from '../components/AttachmentCard/AttachmentCard.module.scss';
import { getAttachmentIcon } from './getAttachmentIcon';

export interface AttachmentCardState {
  isLoading: boolean;
  isError: boolean;
  isImage: boolean;
  areActionsVisible: boolean;
  BottomIcon: Icon;
  typeLabel: string;
  cardColorClass: string;
  removeBtnClass: string;
}

const getBottomIcon = (attachment: DisplayAttachment): Icon => {
  const { type, contentType } = attachment;
  if (type === AttachmentType.Prompt) return IconTerminal2;
  if (type === AttachmentType.Pasted) return IconClipboard;
  if (type === AttachmentType.Image) return IconPhoto;
  return getAttachmentIcon(contentType ?? '');
};

const getExtFromContentType = (contentType: string): string | undefined => {
  const mime = contentType.toLowerCase().split(';')[0].trim();
  const override = MIME_TYPE_EXT_MAP[mime];
  if (override) return override;
  const subtype = mime.split('/')[1];
  // Skip complex vendor/structured subtypes (e.g. vnd.openxmlformats-..., svg+xml)
  if (subtype && !subtype.startsWith('vnd.') && !subtype.includes('+')) {
    return subtype;
  }
  return undefined;
};

const getBottomLabel = (attachment: DisplayAttachment): string => {
  const { type, name, contentType } = attachment;
  if (type === AttachmentType.Prompt) return 'Prompt';
  if (type === AttachmentType.Pasted) return 'Pasted';
  if (type === AttachmentType.Image) return 'Image';

  // Prioritize contentType over name-derived extension
  if (contentType) {
    const ext = getExtFromContentType(contentType);
    if (ext) return `.${ext}`;
  }

  // Fall back to name extension; guard against trailing dots (e.g. sentence endings)
  const lastDot = name.lastIndexOf('.');
  if (lastDot > 0 && lastDot < name.length - 1) {
    return `.${name.slice(lastDot + 1).toLowerCase()}`;
  }

  return name;
};

export const getAttachmentCardState = (
  attachment: DisplayAttachment,
  isSelected: boolean,
  shouldAlwaysShowActions: boolean,
): AttachmentCardState => {
  const { type, status, previewUrl, url } = attachment;

  const isLoading = status === RequestStatus.Loading;
  const isError = status === RequestStatus.Error;
  const isImage =
    type === AttachmentType.Image && !!(previewUrl ?? url) && !isError;

  const cardColorClass = mergeClasses(
    styles.card,
    isError && styles.cardError,
    isSelected && styles.cardSelected,
    !isError &&
      !isSelected &&
      type === AttachmentType.Prompt &&
      styles.cardPrompt,
    !isError &&
      !isSelected &&
      type === AttachmentType.Pasted &&
      styles.cardPasted,
  );

  return {
    isLoading,
    isError,
    isImage,
    areActionsVisible: isError || shouldAlwaysShowActions,
    BottomIcon: getBottomIcon(attachment),
    typeLabel: getBottomLabel(attachment),
    cardColorClass,
    removeBtnClass: isImage ? styles.removeBtnImage : styles.actionBtn,
  };
};
