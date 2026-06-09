import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DeploymentIcon } from '@epam/ai-dial-conversation-input';
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
import type { ConversationHistoryItem } from '../../models/ConversationPanel';
import { getButtonPaddingEnd } from '../../utils/conversation-row.utils';
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
  /** Typography class for the conversation title text. Defaults to `'dial-small-text'`. */
  itemTitleClassName?: string;
}

export const ConversationRow: FC<ConversationRowProps> = ({
  item,
  isActive,
  onSelectConversation,
  getActions,
  actionsLabel = 'More actions',
  itemTitleClassName = 'dial-small-text',
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = getActions?.(item) ?? [];
  const hasActions = menuItems.length > 0;

  const avatar = <DeploymentIcon src={item.iconUrl} size={DIAL_ICON_SIZE.LG} />;

  const buttonPaddingRight = getButtonPaddingEnd(hasActions, isMenuOpen);

  return (
    <li className="group relative">
      <DialGhostButton
        iconBefore={avatar}
        label={item.title}
        textClassName={mergeClasses('truncate min-w-0', itemTitleClassName)}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onSelectConversation(item.id)}
        className={mergeClasses(
          'h-8 w-full justify-start gap-2 ps-3',
          buttonPaddingRight,
          styles.item,
          isActive && styles.itemActive,
        )}
      />

      {hasActions && (
        <div
          className={mergeClasses(
            'absolute inset-y-0 end-1 flex items-center',
            isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <DialDropdown
            items={menuItems}
            onOpenChange={setIsMenuOpen}
            matchReferenceWidth={false}
            listClassName="w-[140px] shadow-md"
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
