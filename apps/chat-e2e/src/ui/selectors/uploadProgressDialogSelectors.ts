export const UploadProgressDialogSelectors = {
  container: '[role="dialog"][aria-modal="true"]:has-text("Uploading items")',
  title: 'div:has-text("Uploading items")',
  fileItem: '[data-qa="file-item"], .rounded.bg-layer-2',
  fileName: '#name',
  progressBar: '.bg-accent-primary',
  progressBarContainer: '.rounded-full.bg-layer-1',
  cancelButton: 'button[aria-label="Cancel"]',
  closeButton: 'button[aria-label="Close dialog"]',
};
