import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  DropdownItem,
  ElementSize,
  GhostIconButton,
  MenuItemMark,
} from '@epam/ai-dial-ui-kit';
import { IconArrowsSort } from '@tabler/icons-react';
import { FC, useMemo } from 'react';
import type { SortMenuButtonProps } from '../../models/sort-menu-button';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
import styles from './SortMenuButton.module.scss';

/* The menu keeps its own width rather than shrinking to the 40px trigger. */
const MENU_LIST_CLASS_NAME = 'min-w-[200px]';

/** Icon-only sort trigger whose menu marks the applied order with a trailing check. */
export const SortMenuButton: FC<SortMenuButtonProps> = ({
  options,
  value,
  onChange,
  label = 'Sort',
  icon,
  size = ElementSize.Standard,
  iconSize = DIAL_ICON_SIZE.MD,
  colors,
  className,
  open,
  onOpenChange,
}) => {
  /*
   * The host passes the values alone; the marking and the click belong here,
   * so the trigger and the menu cannot disagree about which order is applied.
   */
  const items = useMemo<DropdownItem[]>(
    () =>
      options.map((option) => ({
        key: option.value,
        label: option.label,
        mark: MenuItemMark.Check,
        checked: option.value === value,
        onClick: () => onChange(option.value),
      })),
    [options, value, onChange],
  );

  if (options.length === 0) return null;

  return (
    <Dropdown
      items={items}
      open={open}
      onOpenChange={onOpenChange}
      matchReferenceWidth={false}
      listClassName={MENU_LIST_CLASS_NAME}
    >
      <GhostIconButton
        size={size}
        aria-label={label}
        tooltipProps={{ tooltip: label }}
        style={buildCssVars({ '--smb-icon': colors?.icon })}
        className={mergeClasses('shrink-0', styles.trigger, className)}
        icon={
          icon ?? (
            <IconArrowsSort
              size={iconSize}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
            />
          )
        }
      />
    </Dropdown>
  );
};
