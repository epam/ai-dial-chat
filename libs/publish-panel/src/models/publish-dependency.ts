/** Kinds of resource a publish dependency can be. */
export enum PublishDependencyType {
  Application = 'application',
  Toolset = 'toolset',
  Prompt = 'prompt',
  Skill = 'skill',
  File = 'file',
}

/**
 * A resource the item being published refers to that is not in the public
 * bucket, so the published copy may not work for the people it is shared with
 * until this resource is published too.
 */
export interface PublishDependency {
  /** Unique key of the dependency, normally its resource url. */
  id: string;
  /** Display name of the dependency. */
  name: string;
  /** Version, when the dependency is versioned. */
  version?: string;
  /** What kind of resource it is. */
  type: PublishDependencyType;
  /** Already-resolved icon URL of the dependency, when the host has one; without it the row shows the name's initials (a file shows its file-type icon instead). */
  iconUrl?: string;
  /** Whether a `File` dependency is a folder, which gets the folder icon instead of a file-type icon. */
  isFolder?: boolean;
  /** Folder path the dependency sits in, inside its owner's bucket; empty at the bucket root. */
  location: string;
}
