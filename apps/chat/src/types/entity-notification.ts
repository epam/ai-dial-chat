/** Entity kind named in an operation success notification. */
export enum NotifiableEntity {
  Prompt = 'prompt',
  Agent = 'agent',
  QuickApp = 'quickApp',
  CustomApp = 'customApp',
  Toolset = 'toolset',
  Model = 'model',
  Skill = 'skill',
  Conversation = 'conversation',
  File = 'file',
  Folder = 'folder',
}

/** User-initiated operation that confirms itself with a success notification. */
export enum EntityOperation {
  Created = 'created',
  Edited = 'edited',
  Renamed = 'renamed',
  Duplicated = 'duplicated',
  Deleted = 'deleted',
  Downloaded = 'downloaded',
  PublishRequested = 'publishRequested',
  /**
   * Removal of a published copy was submitted for admin approval. Named
   * `UnpublishRequested`, not `Unpublished`: DIAL Core returns a `PENDING`
   * publication, so no copy raised for this operation may claim the entity is
   * no longer published.
   */
  UnpublishRequested = 'unpublishRequested',
}
