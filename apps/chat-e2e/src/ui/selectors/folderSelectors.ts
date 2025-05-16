import { Tags } from '@/src/ui/domData';

export const FolderSelectors = {
  folder: '[data-qa="folder"]',
  rootFolder: () => `${FolderSelectors.folder}[property="root"]`,
  childFolder: () => `${FolderSelectors.folder}[property="child"]`,
  folderGroup: '#folder',
  folderName: () => `[data-qa="folder-name"] > ${Tags.span}`,
  folderCheckbox: '[data-item-checkbox="true"]',
};
