/** Which inline folder sub-form the folder field is currently showing, if any. */
export enum FolderFormMode {
  /** Creating a new folder under the selected one. */
  Create = 'create',
  /** Renaming the selected folder. */
  Rename = 'rename',
  /** Confirming deletion of the selected folder. */
  ConfirmDelete = 'confirmDelete',
}
