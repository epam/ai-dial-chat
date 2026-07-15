import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialEllipsisTooltip, type DropdownItem } from '@epam/ai-dial-ui-kit';
import { IconCaretDownFilled, IconCaretRightFilled } from '@tabler/icons-react';
import { type FC, memo, useId, useState } from 'react';
import type { ConversationItem } from '../../models/panel-props';
import styles from '../ConversationPanel/ConversationPanel.module.scss';
import { ConversationRow } from './ConversationRow';

/** Props for `ConversationGroup`. */
export interface ConversationGroupProps {
  /** Section heading label. */
  label: string;
  /** Conversation items belonging to this group. */
  items: ConversationItem[];
  /** `id` of the currently active conversation. */
  activeConversationId?: string;
  /** Called when the user selects a conversation row. */
  onSelectConversation: (id: string) => void;
  /**
   * Builds the dropdown menu items for a row.
   * Receives the item so actions can reflect per-item state (e.g. pin toggle).
   * When omitted or returns an empty array, no action trigger is rendered.
   */
  getActions?: (item: ConversationItem) => DropdownItem[];
  /** Called when a row action menu opens. */
  onActionMenuOpen?: (
    item: ConversationItem,
    trigger: HTMLButtonElement,
  ) => void;
  /** Accessible label for the actions trigger button. Defaults to `"More actions"`. */
  actionsLabel?: string;
  /** Typography class applied to the group header button. Defaults to `'dial-tiny-semi-text uppercase'`. */
  groupHeaderClassName?: string;
  /** Typography class applied to the conversation title text. */
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
    onActionMenuOpen,
    actionsLabel,
    groupHeaderClassName = 'dial-tiny-semi-text uppercase',
    itemTitleClassName,
  }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const listId = useId();

    if (items.length === 0) return null;

    return (
      <section className="flex flex-col gap-1" aria-label={label}>
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={listId}
          onClick={() => setIsExpanded((prev) => !prev)}
          className={mergeClasses(
            'flex h-6 w-full items-center gap-1 rounded py-1 pe-3 text-start',
            groupHeaderClassName,
            styles.groupHeader,
          )}
        >
          {isExpanded ? (
            <IconCaretDownFilled
              stroke={0.5}
              size={12}
              className="shrink-0"
              aria-hidden
            />
          ) : (
            <IconCaretRightFilled
              stroke={0.5}
              size={12}
              className="shrink-0 rtl:scale-x-[-1]"
              aria-hidden
            />
          )}
          <DialEllipsisTooltip text={label} />
        </button>

        {isExpanded && (
          <ul id={listId} role="list" className="flex flex-col gap-1">
            {items.map((item) => (
              <ConversationRow
                key={item.id}
                item={item}
                isActive={item.id === activeConversationId}
                onSelectConversation={onSelectConversation}
                getActions={getActions}
                onActionMenuOpen={onActionMenuOpen}
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
