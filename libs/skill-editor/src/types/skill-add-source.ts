/** Where an add action was started from, which decides the folder it adds to. */
export enum SkillAddSource {
  /** The Files pane header's Add dropdown: the selected folder, else the root. */
  Header = 'header',
  /** A folder's "Add child" submenu: that folder. */
  Child = 'child',
  /** A node's "Add sibling" submenu: the node's parent folder. */
  Sibling = 'sibling',
}
