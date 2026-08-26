import { mergeClasses, type ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { BASE_ICON_SIZE, type DropdownItem } from '@epam/ai-dial-ui-kit';
import { IconCheck } from '@tabler/icons-react';
import type { CSSProperties } from 'react';

/** Inputs for {@link buildToolMenuItems}. */
export interface BuildToolMenuItemsOptions {
  /** Resolved tool toggle items to render as rows. */
  items: ToolMenuItem[];
  /** Called with the tool id when a row is activated. */
  onToolToggle: (toolId: string) => void;
  /** Screen-reader-only text appended to the label of a selected row. */
  selectedStateLabel: string;
  /** CSS custom properties applied to the row icons, so each host can theme them. */
  style?: CSSProperties;
  /** Class applied to the leading tool icon. */
  iconClassName?: string;
  /** Class applied to the trailing checkmark of a selected row. */
  selectedIconClassName?: string;
}

/**
 * Builds the dropdown rows shared by the permanent Tools button and the
 * "Tools" submenu of the `+` menu, so both entry points render identically.
 */
export const buildToolMenuItems = ({
  items,
  onToolToggle,
  selectedStateLabel,
  style,
  iconClassName,
  selectedIconClassName,
}: BuildToolMenuItemsOptions): DropdownItem[] =>
  items.map((item) => ({
    key: item.id,
    label: (
      <span className="flex flex-1 items-center gap-2">
        <span className="flex-1">{item.label}</span>
        {item.isSelected && (
          <>
            <span className="sr-only">{selectedStateLabel}</span>
            <IconCheck
              size={BASE_ICON_SIZE}
              style={style}
              className={selectedIconClassName}
              aria-hidden
            />
          </>
        )}
      </span>
    ),
    icon: (
      <span
        style={style}
        className={mergeClasses('flex items-center', iconClassName)}
      >
        {item.icon}
      </span>
    ),
    onClick: () => onToolToggle(item.id),
  }));
