import type { DialFileAcceptType } from '@epam/ai-dial-ui-kit';
import { extension as getMimeExtension } from 'mime-types';

const ALL_FILES_ACCEPT_TYPE: DialFileAcceptType = '*/*';

export const isDialFileAcceptType = (
  type: string,
): type is DialFileAcceptType => type.startsWith('.') || type.includes('/');

export const mimeTypesToDialFileAcceptTypes = (
  types?: string[],
): DialFileAcceptType[] | undefined => {
  if (types == null) {
    return undefined;
  }

  return types
    .map((type) => (type === '*' ? ALL_FILES_ACCEPT_TYPE : type))
    .filter(isDialFileAcceptType);
};

export const mimeTypesToAttachmentExtensionLabels = (types: string[]): string =>
  types
    .map((type) => {
      if (type.endsWith('/*')) {
        return type;
      }

      const extension = getMimeExtension(type);

      if (extension !== false) {
        return `.${extension}`;
      }

      const subtype = type.split('/')[1];
      return subtype != null ? `.${subtype.toLowerCase()}` : type;
    })
    .join(', ');
