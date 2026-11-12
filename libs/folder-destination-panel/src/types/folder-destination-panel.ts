/** Which view the folder destination panel shows. */
export enum FolderDestinationView {
  /** Item summary, destination and any host sections. */
  Main = 'main',
  /** The destination folder tree. */
  ChangeFolder = 'change-folder',
}

/** How the folder picker is presented inside the folder destination panel. */
export enum FolderDestinationLayout {
  /** The main view shows the current destination with a Change action; Change opens the folder view, and Select commits the choice. */
  Steps = 'steps',
  /** The folder search and tree are part of the main view and a pick is the destination, so there is no Change or Select step. */
  Inline = 'inline',
}

/** Which icon the summary row shows beside an item's name. */
export enum FolderDestinationItemIcon {
  /** A file icon chosen by the item's extension. */
  File = 'file',
  /** A folder icon. */
  Folder = 'folder',
}
