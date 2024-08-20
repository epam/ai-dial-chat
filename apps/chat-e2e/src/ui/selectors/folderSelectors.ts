export const FolderSelectors = {
  folder: '[data-qa="folder"]',
  rootFolder: () => `${FolderSelectors.folder}[property="root"]`,
  childFolder: '[data-qa="folder"][property="child"]',
  folderGroup: '#folder',
  folderName: '[data-qa="folder-name"]',
  folderCheckbox: '[data-item-checkbox="true"]',
};
