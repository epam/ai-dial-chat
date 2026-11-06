import type { FilterTab } from '@epam/ai-dial-chat-shared';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import type { ConversationRowVariant } from '../types/conversation-row-variant';
import type { ConversationItem } from './panel-props';

/** A pinned project and the chats the host chose to list under it. */
export interface PinnedProjectGroup {
  /** Stable unique id. */
  id: string;
  /** Display name. */
  name: string;
  /** Browser-navigable URL of the project; when set, middle-click opens it in a new tab. */
  href?: string;
  /** Origin tab the project belongs to, for the Origin filter. Defaults to `FilterTab.MyChats`. */
  source?: FilterTab;
  /** The chats listed under the project, in display order. */
  conversations: ConversationItem[];
  /** Renders a See all row after `conversations`. */
  hasMore: boolean;
  /** Whether the project's chats are shown. Defaults to `true`; a search matching one of its chats shows them whatever this says. */
  isExpanded?: boolean;
}

/** The project trees of the Pinned section and their callbacks. */
export interface PinnedProjects {
  /** Projects in display order, rendered before the pinned conversations. */
  projects: PinnedProjectGroup[];
  /** Called when a project row is activated. */
  onSelectProject: (projectId: string) => void;
  /** Called when a nested chat row is activated. */
  onSelectConversation: (conversationId: string, projectId: string) => void;
  /** Called when a See all row is activated. */
  onSeeAll: (projectId: string) => void;
  /** Called with the project id when its chevron is activated; no chevron renders when absent. */
  onToggleProject?: (projectId: string) => void;
  /** Builds the ⋮ actions of a project row; no trigger renders when absent or empty. */
  getActions?: (project: PinnedProjectGroup) => DropdownItem[];
  /** Called when the ⋮ menu of a project row opens; receives the trigger button. */
  onActionMenuOpen?: (
    project: PinnedProjectGroup,
    trigger: HTMLButtonElement,
  ) => void;
  /** Id of the project the host currently shows; its row gets `aria-current="page"`. */
  activeProjectId?: string;
  /** Presentation of the chats nested under a project: `Avatar` gives them the deployment avatar (or `leadingIcon`) and a trailing unread dot like the panel's own rows. Defaults to `ConversationRowVariant.Indicator`. */
  conversationRowVariant?: ConversationRowVariant;
}

/** Position of a row nested under a project row, for its ARIA attributes and guide-line segment. */
export interface NestedRowPosition {
  /** 1-based position among the project's nested rows. */
  posInSet: number;
  /** Number of the project's nested rows: its conversations plus the See all row. */
  setSize: number;
  /** The row is the first nested row of its project. */
  isFirstNested: boolean;
  /** The row is the last nested row of its project. */
  isLastNested: boolean;
}

/** ARIA attributes and classes of a row nested under a project row. */
export interface NestedRowProps {
  /** Tree level of the row; nested rows are level 2. */
  'aria-level': number;
  /** 1-based position among the project's nested rows. */
  'aria-posinset': number;
  /** Number of the project's nested rows. */
  'aria-setsize': number;
  /** Indent and guide-line segment classes. */
  className: string;
}
