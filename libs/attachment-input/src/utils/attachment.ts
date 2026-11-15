import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentType,
  getBaseMimeType,
  MIME_TYPE_EXT_MAP,
  MIMEType,
  normalizeMimeType,
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
import type {
  AttachmentCardState,
  AttachmentTypeLabels,
} from '../models/attachment-card';

/** Generates a unique identifier for an attachment. */
export const generateAttachmentId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Returns the name without its trailing file extension. Returns an empty string when `name` is nullish. */
export const getNameWithoutExtension = (name: string): string => {
  if (name == null) return '';
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.slice(0, dotIndex) : name;
};

const WILDCARD_TYPE_LABELS: Record<string, string> = {
  image: 'Image files',
  audio: 'Audio files',
  video: 'Video files',
  text: 'Text files',
  '*': 'All files',
};

const MIME_TYPE_LABEL_OVERRIDES: Record<string, string> = {
  'image/jpeg': 'JPEG',
};

/** Converts an array of MIME type strings (including wildcards) into a comma-separated human-readable label string. */
export const mimeTypesToExtensionLabels = (
  types: string[],
  wildcardLabels: Record<string, string> = WILDCARD_TYPE_LABELS,
): string => {
  const labels = types.map((type) => {
    const baseType = getBaseMimeType(type);
    if (baseType.endsWith('/*')) {
      const major = baseType.slice(0, -2);
      return wildcardLabels[major] ?? `${major} files`;
    }
    /*
     * Aliases are resolved so a declared `text/json` is labelled from the same
     * entry as the `application/json` it denotes.
     */
    const canonicalType = normalizeMimeType(baseType);
    const labelOverride = MIME_TYPE_LABEL_OVERRIDES[canonicalType];
    if (labelOverride) return labelOverride;
    const extension = MIME_TYPE_EXT_MAP[canonicalType];
    if (extension) return extension.toUpperCase();
    const subtype = canonicalType.split('/')[1];
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
 * - Alias match: both sides are canonicalized, so `'text/json'` allows
 *   `'application/json'` and vice versa.
 * - Parameters and letter case are ignored on both sides.
 *
 * Returns `false` when `allowedTypes` is empty (no attachment types allowed).
 */
export const isMimeTypeAllowed = (
  mimeType: string,
  allowedTypes: string[],
): boolean => {
  if (allowedTypes.length === 0) return false;

  const baseMimeType = getBaseMimeType(mimeType);
  const canonicalMimeType = normalizeMimeType(baseMimeType);

  return allowedTypes.some((allowed) => {
    const baseAllowed = getBaseMimeType(allowed);
    if (baseAllowed === '*' || baseAllowed === '*/*') return true;
    if (baseAllowed.endsWith('/*')) {
      const prefix = baseAllowed.slice(0, -2);
      /*
       * A wildcard is tested against both spellings, so `text/*` still covers a
       * literal `text/json` while `application/*` covers its canonical form.
       */
      return (
        baseMimeType.startsWith(`${prefix}/`) ||
        canonicalMimeType.startsWith(`${prefix}/`)
      );
    }
    return canonicalMimeType === normalizeMimeType(baseAllowed);
  });
};

/*
 * Built on first use rather than at module load: hosts' tests mock
 * `@tabler/icons-react` with only the icons they render, and a module-level
 * table would read every glyph on import.
 */
const createImageTypeIcons = (): Partial<Record<string, Icon>> => ({
  [MIMEType.JPEG]: IconFileTypeJpg,
  [MIMEType.PNG]: IconFileTypePng,
  [MIMEType.SVG]: IconFileTypeSvg,
  [MIMEType.BMP]: IconFileTypeBmp,
});

const createMimeTypeIcons = (): Partial<Record<string, Icon>> => ({
  // Documents
  [MIMEType.PDF]: IconFileTypePdf,
  [MIMEType.DOC]: IconFileTypeDoc,
  [MIMEType.DOCX]: IconFileTypeDocx,
  [MIMEType.PPT]: IconFileTypePpt,
  [MIMEType.PPTX]: IconFileTypePpt,
  [MIMEType.XLS]: IconFileTypeXls,
  [MIMEType.XLSX]: IconFileTypeXls,
  // Archives
  [MIMEType.ZIP]: IconFileTypeZip,
  [MIMEType.RAR]: IconFileTypeZip,
  [MIMEType.SevenZip]: IconFileTypeZip,
  [MIMEType.GZIP]: IconFileTypeZip,
  [MIMEType.TAR]: IconFileTypeZip,
  // Data / markup
  [MIMEType.CSV]: IconFileTypeCsv,
  [MIMEType.Plain]: IconFileTypeTxt,
  [MIMEType.HTML]: IconFileTypeHtml,
  [MIMEType.XHTML]: IconFileTypeHtml,
  [MIMEType.XML]: IconFileTypeXml,
  [MIMEType.SQL]: IconFileTypeSql,
  // Web / code
  [MIMEType.JavaScript]: IconFileTypeJs,
  [MIMEType.JSX]: IconFileTypeJsx,
  [MIMEType.TypeScript]: IconFileTypeTs,
  [MIMEType.TSX]: IconFileTypeTsx,
  [MIMEType.CSS]: IconFileTypeCss,
  [MIMEType.PHP]: IconFileTypePhp,
  [MIMEType.Rust]: IconFileTypeRs,
  [MIMEType.Vue]: IconFileTypeVue,
});

let imageTypeIcons: Partial<Record<string, Icon>> | undefined;
let mimeTypeIcons: Partial<Record<string, Icon>> | undefined;

/** Returns the Tabler icon component for a given MIME content type, or `IconFile` for unknown types. Aliases resolve to their canonical type first. */
export const getAttachmentIcon = (rawContentType: string): Icon => {
  if (!rawContentType) return IconFile;
  const contentType = normalizeMimeType(rawContentType);
  // Broad category checks first
  if (contentType.startsWith('image/')) {
    imageTypeIcons ??= createImageTypeIcons();
    return imageTypeIcons[contentType] ?? IconPhoto;
  }
  if (contentType.startsWith('video/')) return IconVideo;
  if (contentType.startsWith('audio/')) return IconMusic;
  mimeTypeIcons ??= createMimeTypeIcons();
  return mimeTypeIcons[contentType] ?? IconFile;
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
  const mime = normalizeMimeType(contentType);
  const override = MIME_TYPE_EXT_MAP[mime];
  if (override) return override;
  const subtype = mime.split('/')[1];
  // Skip complex vendor/structured subtypes (e.g. vnd.openxmlformats-..., svg+xml)
  if (subtype && !subtype.startsWith('vnd.') && !subtype.includes('+')) {
    return subtype;
  }
  return undefined;
};

/** Returns the attachment's bare file extension (no leading dot), from its content type first and its name second, or `undefined` when neither yields one. */
export const getAttachmentExtension = (
  attachment: DisplayAttachment,
): string | undefined => {
  const { name, contentType } = attachment;
  // Prioritize contentType over name-derived extension
  if (contentType) {
    const ext = getExtFromContentType(contentType);
    if (ext) return ext;
  }
  if (name == null) return undefined;
  // Guard against trailing dots (e.g. sentence endings)
  const lastDot = name.lastIndexOf('.');
  if (lastDot > 0 && lastDot < name.length - 1) {
    return name.slice(lastDot + 1).toLowerCase();
  }
  return undefined;
};

/** Returns `true` when the attachment's type glyph is a file-type icon rather than a prompt or pasted-text glyph. */
export const hasFileTypeGlyph = (attachment: DisplayAttachment): boolean =>
  attachment.type !== AttachmentType.Prompt &&
  attachment.type !== AttachmentType.Pasted;

const getBottomLabel = (
  attachment: DisplayAttachment,
  typeLabels: AttachmentTypeLabels,
): string => {
  const { type, name } = attachment;
  if (type === AttachmentType.Prompt) return typeLabels.promptLabel ?? 'Prompt';
  if (type === AttachmentType.Pasted) return typeLabels.pastedLabel ?? 'Pasted';
  if (type === AttachmentType.Image) return typeLabels.imageLabel ?? 'Image';

  const ext = getAttachmentExtension(attachment);
  if (ext) return `.${ext}`;

  // name may be missing on some backend payloads despite the required type
  return name ?? '';
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
  const isLink = type === AttachmentType.Link && !isError;

  return {
    isLoading,
    isError,
    isImage,
    isLink,
    BottomIcon: isLink ? null : getBottomIcon(attachment),
    typeLabel: isLink ? null : getBottomLabel(attachment, typeLabels),
  };
};
