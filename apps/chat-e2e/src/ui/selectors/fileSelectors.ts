import { Tags } from '@/src/ui/domData';

export const FileSelectors = {
  loadingIndicator: '[data-qa="attachment-loading"]',
  loadingRetry: '[data-qa="retry-upload"]',
  remove: `[data-qa="remove-file"] > ${Tags.svg}`,
};
