import { extension as getMimeExtension } from 'mime-types';

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
