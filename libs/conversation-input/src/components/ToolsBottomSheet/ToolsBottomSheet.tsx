import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import type { ToolMenuItem } from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  MenuItem,
} from '@epam/ai-dial-ui-kit';
import { IconCheck } from '@tabler/icons-react';
import type { CSSProperties, FC } from 'react';
import { BottomSheetShell } from '../BottomSheetShell/BottomSheetShell';
import styles from './ToolsBottomSheet.module.scss';

/** Props for the ToolsBottomSheet component. */
export interface ToolsBottomSheetProps {
  /** Controls sheet visibility. */
  isOpen: boolean;
  /** Called when the back arrow is tapped — returns to the previous sheet. */
  onBack: () => void;
  /** Accessible label for the back arrow button. Defaults to `'Back'`. */
  backLabel?: string;
  /** Called when the close (x) button is tapped — dismisses the sheet entirely. */
  onClose: () => void;
  /** Accessible label for the close (x) button. Defaults to `'Close'`. */
  closeLabel?: string;
  /** Inline CSS custom properties forwarded to the sheet root for theming. */
  style?: CSSProperties;
  /** Sheet title. Defaults to `'Tools'`. */
  title?: string;
  /** Tool items to render as toggle rows. */
  items: ToolMenuItem[];
  /** Called with the tool id when a row is tapped. */
  onToolToggle: (toolId: string) => void;
  /** CSS class applied to each tool row label. Defaults to `'dial-small-text'`. */
  itemLabelClassName?: string;
  /** Color overrides. */
  colors?: ToolsBottomSheetColors;
}

/** Color overrides for `ToolsBottomSheet`, applied as CSS custom properties with app theme fallbacks. */
interface ToolsBottomSheetColors {
  /** Icon color for each tool row. Fallback: `--text-secondary`. */
  iconText?: string;
  /** Checkmark icon color for a selected tool row. Fallback: `--text-accent`. */
  selectedIconText?: string;
}

/**
 * Mobile bottom sheet that renders a list of tool toggle rows with a back
 * arrow to return to the preceding add-menu bottom sheet.
 */
export const ToolsBottomSheet: FC<ToolsBottomSheetProps> = ({
  isOpen,
  onBack,
  backLabel = 'Back',
  onClose,
  closeLabel = 'Close',
  style,
  title = 'Tools',
  items,
  onToolToggle,
  itemLabelClassName = 'dial-small-text',
  colors,
}) => {
  const cssVars = buildCssVars({
    '--tbs-icon-text': colors?.iconText,
    '--tbs-selected-icon-text': colors?.selectedIconText,
  });

  return (
    <BottomSheetShell
      isOpen={isOpen}
      title={title}
      closeLabel={closeLabel}
      onClose={onClose}
      onBack={onBack}
      backLabel={backLabel}
      style={style}
    >
      <div
        role="menu"
        aria-label={title}
        className="flex flex-col px-2 pb-4"
        style={cssVars}
      >
        {items.map((item) => (
          /* The check goes in `trailing` rather than `mark`, so its color
             keeps coming from the `--tbs-selected-icon-text` hook. */
          <MenuItem
            key={item.id}
            role="menuitemcheckbox"
            aria-checked={item.isSelected}
            icon={
              <span className={mergeClasses('flex items-center', styles.icon)}>
                {item.icon}
              </span>
            }
            label={item.label}
            labelClassName={itemLabelClassName}
            trailing={
              item.isSelected ? (
                <span className={mergeClasses('flex', styles.selectedIcon)}>
                  <IconCheck
                    size={BASE_ICON_SIZE}
                    aria-hidden
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                </span>
              ) : undefined
            }
            onClick={() => onToolToggle(item.id)}
          />
        ))}
      </div>
    </BottomSheetShell>
  );
};
