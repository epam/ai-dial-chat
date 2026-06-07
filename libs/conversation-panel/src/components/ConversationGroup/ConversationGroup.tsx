import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialEllipsisTooltip, type DropdownItem } from '@epam/ai-dial-ui-kit';
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
    itemTitleClassName,
  }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (items.length === 0) return null;

    return (
      <section className="flex flex-col gap-1">
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
            <IconCaretDownFilled stroke={0.5} size={12} className="shrink-0" />
          ) : (
            <IconCaretRightFilled stroke={0.5} size={12} className="shrink-0" />
          )}
          <DialEllipsisTooltip text={label} />
        </button>

        {isExpanded && (
          <ul role="list" className="flex flex-col gap-1">
            {items.map((item) => (
              <ConversationRow
                key={item.id}
                item={item}
                isActive={item.id === activeConversationId}
                onSelectConversation={onSelectConversation}
                getActions={getActions}
                actionsLabel={actionsLabel}
                itemTitleClassName={itemTitleClassName}
              />
            ))}
          </ul>
        )}
      </section>
    );
  },
);
