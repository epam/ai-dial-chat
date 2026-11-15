import type { ReactNode } from 'react';

/** One conversation row of the {@link ProjectConversationList}. */
export interface ProjectConversationListItem {
  /** Conversation id, passed back to the callbacks. */
  id: string;
  /** Display title. */
  title: string;
  /** Display name of the conversation's author; part of the row's accessible name. */
  authorName?: string;
  /** Whether the conversation changed since the viewer last opened it. Defaults to `false`. */
  isUnread?: boolean;
  /** Host-rendered leading visual, such as the deployment avatar; replaces the status point. Defaults to the status point. */
  leading?: ReactNode;
  /** Host-rendered visual at the end of the row button, such as an unread indicator; replaces the default unread dot shown beside `leading`. Defaults to that dot. */
  trailing?: ReactNode;
}

/** Localized labels used by the {@link ProjectConversationList} component. */
export interface ProjectConversationListLabels {
  /** Section heading and accessible name, e.g. "Chats". */
  title: string;
  /** Accessible name of a row, built from its title and author. */
  openLabel: (title: string, authorName?: string) => string;
  /** Accessible name of a row's more-actions trigger. */
  moreActionsLabel: (title: string) => string;
  /** Accessible name of the close button of the phone actions sheet. Defaults to `'Close'`. */
  closeLabel?: string;
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
  /** Label of the link that loads more conversations. Defaults to `'See more'`. */
  loadMoreLabel?: string;
  /** Accessible description of an unread row. Defaults to `'Unread'`. */
  unreadLabel?: string;
}

/** Typography overrides for the {@link ProjectConversationList} component. */
export interface ProjectConversationListTypography {
  /** CSS class applied to the section heading. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to each row title. Defaults to `'dial-body-text'`. */
  rowTitleClassName?: string;
  /** CSS class applied to the title of an unread row. Defaults to `'dial-body-semi-text'`. */
  unreadRowTitleClassName?: string;
  /** CSS class applied to the error text. Defaults to `'dial-small-text'`. */
  messageClassName?: string;
}

/** Color overrides for the {@link ProjectConversationList} component, applied as CSS custom properties. */
export interface ProjectConversationListColors {
  /** Outline of a read row's status point. Defaults to `--stroke-secondary`. */
  readDot?: string;
  /** Fill of an unread row's status point. Defaults to `--text-accent`. */
  unreadDot?: string;
  /** Background of a hovered or focused row. Defaults to `--bg-control-accent-alpha-hover`. */
  rowHoverBackground?: string;
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
  /** Shows the empty state while there are no conversations; when `false`, the list renders nothing then. Defaults to `true`. */
  isEmptyStateShown?: boolean;
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
  /** Color overrides. */
  colors?: ProjectConversationListColors;
}
