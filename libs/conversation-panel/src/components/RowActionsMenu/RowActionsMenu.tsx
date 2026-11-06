import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  ElementSize,
  GhostIconButton,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import { IconDotsVertical } from '@tabler/icons-react';
import { memo, useCallback, useRef, type FC } from 'react';
import { ConversationRowVariant } from '../../types/conversation-row-variant';
import styles from '../ConversationPanel/ConversationPanel.module.scss';

/** Props for `RowActionsMenu`. */
export interface RowActionsMenuProps {
  /** Menu entries; the caller renders the menu only when there is at least one. */
  items: DropdownItem[];
  /** Whether the menu is open. */
  isOpen: boolean;
  /** Called when the menu opens or closes. */
  onOpenChange: (isOpen: boolean) => void;
  /** Called with the trigger button when the menu opens. */
  onOpen?: (trigger: HTMLButtonElement) => void;
  /** Accessible label of the trigger button. */
  actionsLabel: string;
  /** Presentation of the row the trigger sits in. Defaults to `ConversationRowVariant.Indicator`. */
  variant?: ConversationRowVariant;
}

const RowActionsMenuComponent: FC<RowActionsMenuProps> = ({
  items,
  isOpen,
  onOpenChange,
  onOpen,
  actionsLabel,
  variant = ConversationRowVariant.Indicator,
}) => {
  const isIndicator = variant === ConversationRowVariant.Indicator;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const handleOpenChange = useCallback(
    (nextIsOpen: boolean) => {
      onOpenChange(nextIsOpen);
      if (nextIsOpen && triggerRef.current) onOpen?.(triggerRef.current);
    },
    [onOpenChange, onOpen],
  );

  return (
    <div
      className={mergeClasses(
        'absolute inset-y-0 flex items-center',
        isIndicator ? 'inset-e-2' : 'inset-e-1',
        isOpen
          ? 'opacity-100'
          : 'opacity-0 group-focus-within/conversation:opacity-100 group-hover/conversation:opacity-100',
      )}
    >
      <Dropdown
        items={items}
        onOpenChange={handleOpenChange}
        matchReferenceWidth={false}
        listClassName="w-[200px]"
      >
        <GhostIconButton
          ref={triggerRef}
          icon={
            <IconDotsVertical
              size={isIndicator ? DIAL_ICON_SIZE.SM : DIAL_ICON_SIZE.MD}
              className={styles.triggerIcon}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          size={ElementSize.Small}
          aria-label={actionsLabel}
          className={mergeClasses(
            /* A 24px box around the 16px glyph (4px padding). */
            isIndicator && 'size-6! min-h-0! min-w-0! p-1!',
            styles.trigger,
            isOpen && styles.triggerActive,
          )}
        />
      </Dropdown>
    </div>
  );
};

/** The ⋮ trigger and dropdown of a conversation-list row. */
export const RowActionsMenu = memo(RowActionsMenuComponent);
