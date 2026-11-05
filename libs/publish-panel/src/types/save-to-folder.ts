/** Whether a save keeps the resource's current version or writes a new one. */
export enum SaveVersionMode {
  /** Save in place under the current version. */
  Keep = 'keep',
  /** Save the edits as a new version; the current one stays as last saved. */
  New = 'new',
}

/** Which view the save-to-folder panel shows. */
export enum SaveToFolderView {
  /** Summary, destination and version choice. */
  Main = 'main',
  /** The destination folder tree. */
  ChangeFolder = 'change-folder',
}
