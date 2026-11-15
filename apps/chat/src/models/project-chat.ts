/** What a project chat page needs from its project before the details load. */
export interface ProjectChatProjectSummary {
  /** The project's DIAL id. */
  id: string;
  /** The project's display name, for the chat header. */
  name: string;
  /** Whether the caller may write the project's chats: the owner, or a recipient with edit access. */
  canEdit: boolean;
}

/** Router state a project page hands to a project chat it opens. */
export interface ProjectChatNavigationState {
  /** The project already loaded by the opening page, so the chat renders without waiting for the details. */
  project?: ProjectChatProjectSummary;
}
