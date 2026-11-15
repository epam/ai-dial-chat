/** Discriminates between the virtual row types in the conversation list. */
export enum VirtualRowKind {
  Header = 'header',
  Item = 'item',
  /** A pinned project row in the Pinned section. */
  Project = 'project',
  /** A conversation nested under a pinned project row. */
  ProjectConversation = 'project-conversation',
  /** The See all row that closes a pinned project's nested rows. */
  ProjectSeeAll = 'project-see-all',
}
