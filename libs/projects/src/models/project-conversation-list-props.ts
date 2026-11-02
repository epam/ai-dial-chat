/** One conversation row of the {@link ProjectConversationList}. */
export interface ProjectConversationListItem {
  /** Conversation id, passed back to the callbacks. */
  id: string;
  /** Display title. */
  title: string;
  /** Display name of the conversation's author; drives the avatar initials. */
  authorName?: string;
}

/** Localized labels used by the {@link ProjectConversationList} component. */
export interface ProjectConversationListLabels {
  /** Section heading and accessible name, e.g. "Chats". */
  title: string;
  /** Accessible name of a row, built from its title and author. */
  openLabel: (title: string, authorName?: string) => string;
  /** Accessible name of a row's more-actions trigger. */
  moreActionsLabel: (title: string) => string;
  /** Rename menu item label. */
  renameLabel: string;
  /** Delete menu item label. */
  deleteLabel: string;
  /** Announced while the list loads. */
  loadingLabel: string;
  /** Shown when the list could not be loaded. */
  errorLabel: string;
  /** Retry action label. */
  retryLabel: string;
  /** Empty-state title. */
  emptyTitle: string;
  /** Empty-state description. */
  emptyDescription: string;
  /** Label of the action that loads more conversations. Defaults to `'Show more'`. */
  loadMoreLabel?: string;
}

/** Typography overrides for the {@link ProjectConversationList} component. */
export interface ProjectConversationListTypography {
  /** CSS class applied to the section heading. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to each row title. Defaults to `'dial-body-text'`. */
  rowTitleClassName?: string;
  /** CSS class applied to the error text. Defaults to `'dial-small-text'`. */
  messageClassName?: string;
}

/** Props for the {@link ProjectConversationList} component. */
export interface ProjectConversationListProps {
  /** Conversations, in display order. */
  items: ProjectConversationListItem[];
  /** Shows the loading state. Defaults to `false`. */
  isLoading?: boolean;
  /** Shows the error state with a retry action. Defaults to `false`. */
  hasError?: boolean;
  /** Called from the retry action of the error state. */
  onRetry: () => void;
  /** More conversations exist after `items`; shows the load-more action when `onLoadMore` is set. Defaults to `false`. */
  hasMore?: boolean;
  /** Disables the load-more action while the next page loads. Defaults to `false`. */
  isLoadingMore?: boolean;
  /** Called from the load-more action. */
  onLoadMore?: () => void;
  /** Called with a conversation id when the user activates its row. */
  onOpen: (id: string) => void;
  /** Called from a row's Rename item; the item is hidden when omitted. */
  onRename?: (id: string) => void;
  /** Called from a row's Delete item; the item is hidden when omitted. */
  onDelete?: (id: string) => void;
  /** Localized labels. */
  labels: ProjectConversationListLabels;
  /** Typography overrides. */
  typography?: ProjectConversationListTypography;
}
