/** Filter tab identifier; also used as conversation source and group key. */
export enum FilterTab {
  All = 'all',
  Pinned = 'pinned',
  MyChats = 'my-chats',
  Shared = 'shared',
  Organization = 'organization',
}

/** What a conversation is: an ordinary chat or the run of a scheduled task. */
export enum ConversationKind {
  Chat = 'chat',
  Task = 'task',
}
