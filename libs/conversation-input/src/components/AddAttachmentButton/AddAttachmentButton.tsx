import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  DIAL_ICON_SIZE,
  DialDropdown,
  DialGhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconPaperclip, IconPlus } from '@tabler/icons-react';
import { CSSProperties, type FC, useMemo, useState } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { BottomSheet } from '../BottomSheet/BottomSheet';
import type { BottomSheetItem } from '../BottomSheet/BottomSheet';

interface AddAttachmentButtonProps {
  /** Callback invoked when the user picks "Attach file". */
  onAttachClick: () => void;
  /** Label for the "Attach file" menu item. */
  attachLabel: string;
  /** Aria-label for the + trigger button. */
  addMenuLabel: string;
  /** Title shown in the mobile bottom sheet. */
  menuTitle: string;
  /** Close label for the mobile bottom sheet. */
  menuCloseLabel: string;
  /** CSS custom-property overrides forwarded to the mobile BottomSheet. */
  style?: CSSProperties;
  /** Width class applied to the desktop dropdown list. Defaults to `'!w-[240px]'`. */
  listClassName?: string;
  /** When `true`, the trigger button is disabled and the menu cannot open. */
  isDisabled?: boolean;
  /** Additional items appended after the built-in "Attach file" entry. */
  extraMenuItems?: BottomSheetItem[];
}

export const AddAttachmentButton: FC<AddAttachmentButtonProps> = ({
  onAttachClick,
  attachLabel,
  addMenuLabel,
  menuTitle,
  menuCloseLabel,
  style,
  listClassName = '!w-[240px] shadow-md',
  isDisabled = false,
  extraMenuItems,
}) => {
  const isMobile = useIsMobile();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const menuItems = useMemo(
    () => [
      {
        key: 'attach',
        label: attachLabel,
        icon: <IconPaperclip size={BASE_ICON_SIZE} aria-hidden />,
        onClick: onAttachClick,
      },
      ...(extraMenuItems ?? []),
    ],
    [attachLabel, onAttachClick, extraMenuItems],
  );

  if (isMobile) {
    return (
      <>
        <DialGhostIconButton
          icon={<IconPlus size={DIAL_ICON_SIZE.LG} aria-hidden />}
          aria-label={addMenuLabel}
          className={mergeClasses(
            'size-10 flex-shrink-0',
            isDisabled && 'pointer-events-none opacity-50',
          )}
          onClick={() => setIsSheetOpen(true)}
        />
        <BottomSheet
          isOpen={isSheetOpen}
          title={menuTitle}
          closeLabel={menuCloseLabel}
          onClose={() => setIsSheetOpen(false)}
          style={style}
          items={menuItems}
        />
      </>
    );
  }

  return (
    <DialDropdown
      matchReferenceWidth={false}
      placement="bottom-start"
      listClassName={listClassName}
      items={menuItems}
    >
      <DialGhostIconButton
        icon={<IconPlus size={DIAL_ICON_SIZE.LG} aria-hidden />}
        aria-label={addMenuLabel}
        className="size-10 flex-shrink-0"
        disabled={isDisabled}
      />
    </DialDropdown>
  );
};
