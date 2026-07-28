import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentType,
  MIME_TYPE_EXT_MAP,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import type { Icon } from '@tabler/icons-react';
import {
  IconClipboard,
  IconFile,
  IconFileTypeBmp,
  IconFileTypeCss,
  IconFileTypeCsv,
  IconFileTypeDoc,
  IconFileTypeDocx,
  IconFileTypeHtml,
  IconFileTypeJpg,
  IconFileTypeJs,
  IconFileTypeJsx,
  IconFileTypePdf,
  IconFileTypePhp,
  IconFileTypePng,
  IconFileTypePpt,
  IconFileTypeRs,
  IconFileTypeSql,
  IconFileTypeSvg,
  IconFileTypeTs,
  IconFileTypeTsx,
  IconFileTypeTxt,
  IconFileTypeVue,
  IconFileTypeXls,
  IconFileTypeXml,
  IconFileTypeZip,
  IconMusic,
  IconPhoto,
  IconTerminal2,
  IconVideo,
} from '@tabler/icons-react';
import {
  ATTACHMENT_COLLAPSE_THRESHOLD,
  ATTACHMENT_COLLAPSED_VISIBLE_COUNT,
} from '../constants/attachment-group';
import type {
  AttachmentCardState,
  AttachmentTypeLabels,
} from '../models/attachment-card';
import {
  AttachmentTilesLayout,
  type AttachmentTilesPlan,
} from '../models/attachment-group';

/** Generates a unique identifier for an attachment. */
export const generateAttachmentId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Returns the name without its trailing file extension. */
export const getNameWithoutExtension = (name: string): string => {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.slice(0, dotIndex) : name;
};

const WILDCARD_TYPE_LABELS: Record<string, string> = {
  image: 'Image files',
  audio: 'Audio files',
  video: 'Video files',
  text: 'Text files',
};

/** Converts an array of MIME type strings (including wildcards) into a comma-separated human-readable label string. */
export const mimeTypesToExtensionLabels = (
  types: string[],
  wildcardLabels: Record<string, string> = WILDCARD_TYPE_LABELS,
): string => {
  const labels = types.map((type) => {
    if (type.endsWith('/*')) {
      const major = type.slice(0, -2);
      return wildcardLabels[major] ?? `${major} files`;
    }
    const subtype = type.split('/')[1];
    return subtype != null ? subtype.toUpperCase() : type.toUpperCase();
  });
  return labels.join(', ');
};

/**
 * Returns `true` when `mimeType` matches at least one entry in `allowedTypes`.
 *
 * Matching rules:
 * - Exact match: `'application/pdf'` allows `'application/pdf'`.
 * - Wildcard prefix: `'image/*'` allows any `'image/...'` MIME type.
 *
 * Returns `false` when `allowedTypes` is empty (no attachment types allowed).
 */
export const isMimeTypeAllowed = (
  mimeType: string,
  allowedTypes: string[],
): boolean => {
  if (allowedTypes.length === 0) return false;
  return allowedTypes.some((allowed) => {
    if (allowed === '*' || allowed === '*/*') return true;
    if (allowed.endsWith('/*')) {
      const prefix = allowed.slice(0, -2);
      return mimeType.startsWith(`${prefix}/`);
    }
    return mimeType === allowed;
  });
};

/** Returns the Tabler icon component for a given MIME content type, or `IconFile` for unknown types. */
export const getAttachmentIcon = (contentType: string): Icon => {
  if (!contentType) return IconFile;
  // Broad category checks first
  if (contentType.startsWith('image/')) {
    switch (contentType) {
      case 'image/jpeg':
      case 'image/jpg':
        return IconFileTypeJpg;
      case 'image/png':
        return IconFileTypePng;
      case 'image/svg+xml':
        return IconFileTypeSvg;
      case 'image/bmp':
        return IconFileTypeBmp;
      default:
        return IconPhoto;
    }
  }

  if (contentType.startsWith('video/')) return IconVideo;
  if (contentType.startsWith('audio/')) return IconMusic;

  // Specific MIME type switch
  switch (contentType) {
    // Documents
    case 'application/pdf':
      return IconFileTypePdf;
    case 'application/msword':
    case 'application/vnd.ms-word':
      return IconFileTypeDoc;
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return IconFileTypeDocx;
    case 'application/vnd.ms-powerpoint':
      return IconFileTypePpt;
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return IconFileTypePpt;
    case 'application/vnd.ms-excel':
      return IconFileTypeXls;
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return IconFileTypeXls;

    // Archives
    case 'application/zip':
    case 'application/x-zip-compressed':
    case 'application/x-rar-compressed':
    case 'application/x-7z-compressed':
    case 'application/gzip':
    case 'application/x-tar':
      return IconFileTypeZip;

    // Data / markup
    case 'text/csv':
      return IconFileTypeCsv;
    case 'text/plain':
      return IconFileTypeTxt;
    case 'text/html':
    case 'application/xhtml+xml':
      return IconFileTypeHtml;
    case 'text/xml':
    case 'application/xml':
      return IconFileTypeXml;
    case 'application/sql':
    case 'text/x-sql':
      return IconFileTypeSql;

    // Web / code
    case 'text/javascript':
    case 'application/javascript':
      return IconFileTypeJs;
    case 'text/jsx':
      return IconFileTypeJsx;
    case 'application/typescript':
    case 'text/typescript':
      return IconFileTypeTs;
    case 'text/tsx':
      return IconFileTypeTsx;
    case 'text/css':
      return IconFileTypeCss;
    case 'text/x-php':
    case 'application/x-php':
      return IconFileTypePhp;
    case 'text/x-rustsrc':
    case 'application/x-rust':
      return IconFileTypeRs;
    case 'text/x-vue':
      return IconFileTypeVue;

    default:
      return IconFile;
  }
};

const getBottomIcon = (attachment: DisplayAttachment): Icon => {
  const { type, contentType } = attachment;
  if (type === AttachmentType.Prompt) return IconTerminal2;
  if (type === AttachmentType.Pasted) return IconClipboard;
  if (type === AttachmentType.Image) return IconPhoto;
  return getAttachmentIcon(contentType ?? '');
};

/** Derives a bare file extension (no leading dot) from a MIME type, e.g. `'application/pdf'` -> `'pdf'`. */
export const getExtFromContentType = (
  contentType: string,
): string | undefined => {
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

const getBottomLabel = (
  attachment: DisplayAttachment,
  typeLabels: AttachmentTypeLabels,
): string => {
  const { type, name, contentType } = attachment;
  if (type === AttachmentType.Prompt) return typeLabels.promptLabel ?? 'Prompt';
  if (type === AttachmentType.Pasted) return typeLabels.pastedLabel ?? 'Pasted';
  if (type === AttachmentType.Image) return typeLabels.imageLabel ?? 'Image';

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

/** Derives the display state (icons, labels, color classes) an AttachmentCard needs to render a given attachment. */
export const getAttachmentCardState = (
  attachment: DisplayAttachment,
  typeLabels: AttachmentTypeLabels = {},
): AttachmentCardState => {
  const { type, status, previewUrl, url } = attachment;

  const isLoading = status === RequestStatus.Loading;
  const isError = status === RequestStatus.Error;
  const isImage =
    type === AttachmentType.Image && !!(previewUrl ?? url) && !isError;
  const isAudio = type === AttachmentType.Audio && !isError;
  const isLink = type === AttachmentType.Link && !isError;

  return {
    isLoading,
    isError,
    isImage,
    isAudio,
    isLink,
    BottomIcon: isLink ? null : getBottomIcon(attachment),
    typeLabel: isLink ? null : getBottomLabel(attachment, typeLabels),
  };
};

/** Decides how the unified tile grid should render for `totalCount` attachments, given whether the group is expanded. */
export const getAttachmentTilesPlan = (
  totalCount: number,
  isExpanded: boolean,
): AttachmentTilesPlan => {
  if (totalCount <= 0) {
    return {
      layout: AttachmentTilesLayout.None,
      visibleCount: 0,
      hiddenCount: 0,
    };
  }
  if (totalCount < ATTACHMENT_COLLAPSE_THRESHOLD || isExpanded) {
    return {
      layout: AttachmentTilesLayout.AllVisible,
      visibleCount: totalCount,
      hiddenCount: 0,
    };
  }
  return {
    layout: AttachmentTilesLayout.Collapsed,
    visibleCount: ATTACHMENT_COLLAPSED_VISIBLE_COUNT,
    hiddenCount: totalCount - ATTACHMENT_COLLAPSED_VISIBLE_COUNT,
  };
};
