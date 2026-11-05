import {
  BottomSheet,
  Dropdown,
  type DropdownItem,
  DropdownItemType,
  MenuItem,
} from '@epam/ai-dial-ui-kit';
import {
  cloneElement,
  type ComponentProps,
  type FC,
  type MouseEvent,
  type ReactElement,
  useState,
} from 'react';
import { useIsPhone } from '../../hooks/useIsPhone';

/** Props for `ActionMenu`. */
export interface ActionMenuProps {
  /** Actions of the menu. Dividers, plain-text rows and nested items are shown by the desktop dropdown only. */
  items: DropdownItem[];
  /** Trigger element; on a phone it gets the click handler that opens the sheet, so it must accept `onClick`. */
  children: ReactElement<{ onClick?: (event: MouseEvent) => void }>;
  /** Title and accessible name of the phone sheet. */
  title: string;
  /** Accessible name of the phone sheet's close button. Defaults to `'Close'`. */
  closeLabel?: string;
  /** Placement of the desktop dropdown. Defaults to automatic placement. */
  placement?: ComponentProps<typeof Dropdown>['placement'];
  /** Whether the desktop dropdown is as wide as its trigger. Defaults to `true`. */
  matchReferenceWidth?: boolean;
  /** CSS class applied to the desktop dropdown's list. */
  listClassName?: string;
  /** Called when the menu opens or closes, on either surface. */
  onOpenChange?: (isOpen: boolean) => void;
}

/** Action menu that opens as the kit dropdown on tablet and desktop and as a bottom sheet on a phone. */
export const ActionMenu: FC<ActionMenuProps> = ({
  items,
  children,
  title,
  closeLabel = 'Close',
  placement,
  matchReferenceWidth,
  listClassName,
  onOpenChange,
}) => {
  const isPhone = useIsPhone();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  if (!isPhone) {
    return (
      <Dropdown
        items={items}
        placement={placement}
        matchReferenceWidth={matchReferenceWidth}
        listClassName={listClassName}
        onOpenChange={onOpenChange}
      >
        {children}
      </Dropdown>
    );
  }

  const changeSheetOpen = (isOpen: boolean) => {
    setIsSheetOpen(isOpen);
    onOpenChange?.(isOpen);
  };

  const handleTriggerClick = (event: MouseEvent) => {
    children.props.onClick?.(event);
    changeSheetOpen(true);
  };

  const handleSelect = (item: DropdownItem, event: MouseEvent) => {
    changeSheetOpen(false);
    item.onClick?.({ key: item.key, domEvent: event });
  };

  const actions = items.filter(
    (item) =>
      item.type !== DropdownItemType.Divider &&
      item.type !== DropdownItemType.PlainText &&
      !item.children?.length,
  );

  return (
    <>
      {cloneElement(children, {
        onClick: handleTriggerClick,
        'aria-haspopup': 'dialog',
        'aria-expanded': isSheetOpen,
      } as Partial<ActionMenuProps['children']['props']>)}
      <BottomSheet
        open={isSheetOpen}
        title={title}
        closeAriaLabel={closeLabel}
        onClose={() => changeSheetOpen(false)}
      >
        <div role="menu" aria-label={title}>
          {actions.map((item) => (
            <MenuItem
              key={item.key}
              role="menuitem"
              label={item.label}
              icon={item.icon}
              disabled={item.disabled}
              danger={item.danger}
              onClick={(event) => handleSelect(item, event)}
            />
          ))}
        </div>
      </BottomSheet>
    </>
  );
};
