import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  DIAL_ICON_SIZE,
  DialDropdown,
  DialGhostButton,
  DialIconButton,
  ElementSize,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import { IconDotsVertical } from '@tabler/icons-react';
import { useState, type FC } from 'react';
import type { ConversationHistoryItem } from '../../models/ConversationPanel.js';
import { getButtonPaddingRight } from '../../utils/conversation-row.utils.js';
import styles from '../ConversationPanel/ConversationPanel.module.scss';

export interface ConversationRowProps {
  /** The conversation item to display. */
  item: ConversationHistoryItem;
  /** Whether this row is currently active/selected. */
  isActive: boolean;
  /** Called when the user clicks the row to select the conversation. */
  onSelectConversation: (id: string) => void;
  /**
   * Builds the dropdown menu items for this row.
   * Receives the item so actions can reflect per-item state (e.g. pin toggle).
   * When omitted or returns an empty array, the actions trigger is not rendered.
   */
  getActions?: (item: ConversationHistoryItem) => DropdownItem[];
  /** Accessible label for the actions trigger button. Defaults to `"More actions"`. */
  actionsLabel?: string;
  /** Typography class for the initial-letter icon fallback. Defaults to `'text-xs font-bold'`. */
  itemIconClassName?: string;
  /** Typography class for the conversation title text. Defaults to `'dial-small-text'`. */
  itemTitleClassName?: string;
}

export const ConversationRow: FC<ConversationRowProps> = ({
  item,
  isActive,
  onSelectConversation,
  getActions,
  actionsLabel = 'More actions',
  itemIconClassName = 'text-xs font-bold',
  itemTitleClassName = 'dial-small-text',
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = getActions?.(item) ?? [];
  const hasActions = menuItems.length > 0;

  const avatar = item.iconUrl ? (
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
  );

  const buttonPaddingRight = getButtonPaddingRight(hasActions, isMenuOpen);

  return (
    <li className="group relative">
      <DialGhostButton
        iconBefore={avatar}
        label={item.title}
        textClassName={mergeClasses('truncate min-w-0', itemTitleClassName)}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onSelectConversation(item.id)}
        className={mergeClasses(
          'h-8 w-full justify-start gap-2 pl-3',
          buttonPaddingRight,
          styles.item,
          isActive && styles.itemActive,
        )}
      />

      {hasActions && (
        <div
          className={mergeClasses(
            'absolute inset-y-0 right-1 flex items-center',
            isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <DialDropdown
            items={menuItems}
            onOpenChange={setIsMenuOpen}
            matchReferenceWidth={false}
          >
            <DialIconButton
              icon={
                <IconDotsVertical
                  size={DIAL_ICON_SIZE.SM}
                  className={styles.triggerIcon}
                />
              }
              appearance={ButtonAppearance.Ghost}
              size={ElementSize.Small}
              aria-label={actionsLabel}
              className={mergeClasses(
                'flex items-center justify-center rounded',
                styles.trigger,
                isActive && styles.triggerActive,
              )}
            />
          </DialDropdown>
        </div>
      )}
    </li>
  );
};
