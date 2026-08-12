/** Entity kind named in an operation success notification. */
export enum NotifiableEntity {
  Prompt = 'prompt',
  Agent = 'agent',
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
}
