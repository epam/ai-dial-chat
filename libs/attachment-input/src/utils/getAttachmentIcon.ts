import {
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
  IconPhoto,
  IconVideo,
  IconMusic,
} from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';

/**
 * Returns the appropriate Tabler icon component for a given MIME content type.
 * Broad category checks (`startsWith`) run first; then a specific MIME switch
 * covers as many known file types as possible. Falls back to `IconFile`.
 */
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
