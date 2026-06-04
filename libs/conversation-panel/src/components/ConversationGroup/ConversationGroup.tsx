import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { IconCaretDownFilled, IconCaretRightFilled } from '@tabler/icons-react';
import { type FC, memo, useState } from 'react';
import type { ConversationHistoryItem } from '../../models/ConversationPanel.js';
import styles from '../ConversationPanel/ConversationPanel.module.scss';

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
  /** Typography class applied to the group header button. Defaults to `'dial-tiny-text'`. */
  groupHeaderClassName?: string;
  /** Typography class applied to the initial-letter icon fallback. Defaults to `'text-xs font-bold'`. */
  itemIconClassName?: string;
  /** Typography class applied to the conversation title text. Defaults to `'dial-small-text'`. */
  itemTitleClassName?: string;
}
// TODO: review all styles ((!!!!))
/** Collapsible section rendering a labelled group of conversation rows. */
export const ConversationGroup: FC<ConversationGroupProps> = memo(
  ({
    label,
    items,
    activeConversationId,
    onSelectConversation,
    groupHeaderClassName = 'dial-tiny-text',
    itemIconClassName = 'text-xs font-bold',
    itemTitleClassName = 'dial-small-text',
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
            <IconCaretDownFilled size={12} className="shrink-0" />
          ) : (
            <IconCaretRightFilled size={12} className="shrink-0" />
          )}
          <span className="truncate">{label}</span>
        </button>

        {isExpanded && (
          <ul role="list" className="flex flex-col gap-0.5">
            {items.map((item) => {
              const isActive = item.id === activeConversationId;
              return (
                <li key={item.id} role="listitem">
                  <button
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => onSelectConversation(item.id)}
                    className={mergeClasses(
                      'flex h-8 w-full items-center gap-2 rounded py-1 pl-3 pr-3 text-left',
                      styles.item,
                      isActive && styles.itemActive,
                    )}
                  >
                    {item.iconUrl ? (
                      <img
                        src={item.iconUrl}
                        alt=""
                        aria-hidden="true"
                        className="size-6 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className={mergeClasses(
                          'flex size-6 shrink-0 items-center justify-center rounded-full',
                          itemIconClassName,
                          styles.itemIcon,
                        )}
                        aria-hidden="true"
                      >
                        {item.title.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span
                      className={mergeClasses('truncate', itemTitleClassName)}
                    >
                      {item.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  },
);
