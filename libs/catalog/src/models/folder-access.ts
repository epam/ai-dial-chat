/** A person's or group's level of access to a folder. */
export enum AccessRole {
  Owner = 'owner',
  Editor = 'editor',
  Viewer = 'viewer',
}

/** An individual person with access to a folder. */
export interface FolderAccessMember {
  /** Unique identifier; compared against the viewer's own id to derive "(you)". */
  id: string;
  /** Display name. Initials and avatar colour are derived from this. */
  name: string;
  /** This person's access level. */
  role: AccessRole;
}

/** A group of people sharing the same access level to a folder. */
export interface FolderAccessGroup {
  /** Unique identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** This group's access level. */
  role: AccessRole;
  /** Number of people in the group. */
  memberCount: number;
}

/** Who has access to a specific destination folder, for the Publish flow's "Folder access" section. */
export interface FolderAccessData {
  /** Individual people with access to the folder. */
  people: FolderAccessMember[];
  /** Groups with access to the folder. */
  groups: FolderAccessGroup[];
  /** Whether this data is still loading. */
  isLoading?: boolean;
  /** Error message if this data failed to load. */
  error?: string | null;
}
