export const ShareModalSelectors = {
  modalContainer: '[data-qa="share-modal"]',
  shareLink: '[data-qa="share-link"]',
  copyLink: '[data-qa="copy-link"]',
  entityName: '[data-qa="modal-entity-name"]',
  shareText: ' .text-sm',
};

export const AttachFilesModalSelectors = {
  modalContainer: '[data-qa="file-manager-modal"]',
  attachedFile: '[data-qa="attached-file"]',
  attachedFileIcon: '[data-qa="attached-file-icon"]',
  attachFilesButton: '[data-qa="attach-files"]',
};

export const UploadFromDeviceModalSelectors = {
  modalContainer: '[data-qa="pre-upload-modal"]',
  uploadButton: '[data-qa="upload"]',
};
