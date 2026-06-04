import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, type DropdownItem } from '@epam/ai-dial-ui-kit';
import { IconCaretDownFilled, IconCaretRightFilled } from '@tabler/icons-react';
import { type FC, memo, useState } from 'react';
import type { ConversationHistoryItem } from '../../models/ConversationPanel.js';
import styles from '../ConversationPanel/ConversationPanel.module.scss';
import { ConversationRow } from './ConversationRow.js';

/** Props for `ConversationGroup`. */
export interface ConversationGroupProps {
  /** Section heading label. */
  label: string;
  /** Conversation items belonging to this group. */
  items: ConversationHistoryItem[];
  /** `id` of the currently active conversation. */
  activeConversationId?: string;
  /** Called when the user selects a conversation row. */
  onSelectConversation: (id: string) => void;
  /**
   * Builds the dropdown menu items for a row.
   * Receives the item so actions can reflect per-item state (e.g. pin toggle).
   * When omitted or returns an empty array, no action trigger is rendered.
   */
  getActions?: (item: ConversationHistoryItem) => DropdownItem[];
  /** Accessible label for the actions trigger button. Defaults to `"More actions"`. */
  actionsLabel?: string;
  /** Typography class applied to the group header button. Defaults to `'dial-tiny-text'`. */
  groupHeaderClassName?: string;
  /** Typography class applied to the initial-letter icon fallback. Defaults to `'text-xs font-bold'`. */
  itemIconClassName?: string;
  /** Typography class applied to the conversation title text. Defaults to `'dial-small-text'`. */
  itemTitleClassName?: string;
}

/** Collapsible section rendering a labelled group of conversation rows. */
export const ConversationGroup: FC<ConversationGroupProps> = memo(
  ({
    label,
    items,
    activeConversationId,
    onSelectConversation,
    getActions,
    actionsLabel,
    groupHeaderClassName = 'dial-tiny-text',
    itemIconClassName,
    itemTitleClassName,
  }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (items.length === 0) return null;

    return (
      <section>
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((prev) => !prev)}
          className={mergeClasses(
            'flex h-6 w-full items-center gap-1 rounded py-1 pr-3 text-left',
            groupHeaderClassName,
            styles.groupHeader,
          )}
        >
          {isExpanded ? (
            <IconCaretDownFilled
              size={DIAL_ICON_SIZE.SM}
              className="shrink-0"
            />
          ) : (
            <IconCaretRightFilled
              size={DIAL_ICON_SIZE.SM}
              className="shrink-0"
            />
          )}
          <span className="truncate">{label}</span>
        </button>

        {isExpanded && (
          <ul role="list" className="flex flex-col gap-0.5">
            {items.map((item) => (
              <ConversationRow
                key={item.id}
                item={item}
                isActive={item.id === activeConversationId}
                onSelectConversation={onSelectConversation}
                getActions={getActions}
                actionsLabel={actionsLabel}
                itemIconClassName={itemIconClassName}
                itemTitleClassName={itemTitleClassName}
              />
            ))}
          </ul>
        )}
      </section>
    );
  },
);
