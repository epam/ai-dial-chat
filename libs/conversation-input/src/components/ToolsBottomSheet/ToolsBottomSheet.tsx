import type { ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { BASE_ICON_SIZE, DialButton } from '@epam/ai-dial-ui-kit';
import { IconCheck } from '@tabler/icons-react';
import type { CSSProperties, FC } from 'react';
import { BottomSheetShell } from '../BottomSheetShell/BottomSheetShell';

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
}) => (
  <BottomSheetShell
    isOpen={isOpen}
    title={title}
    closeLabel={closeLabel}
    onClose={onClose}
    onBack={onBack}
    backLabel={backLabel}
    style={style}
  >
    <ul role="menu" className="flex flex-col pb-4">
      {items.map((item) => (
        <li key={item.id} role="none">
          <DialButton
            type="button"
            role="menuitemcheckbox"
            aria-checked={item.isSelected}
            className="flex w-full items-center gap-3 px-4 py-[10px] text-start"
            iconBefore={
              <span className="flex items-center text-secondary">
                {item.icon}
              </span>
            }
            iconAfter={
              item.isSelected ? (
                <span className="ms-auto text-accent-primary">
                  <IconCheck size={BASE_ICON_SIZE} aria-hidden />
                </span>
              ) : null
            }
            label={<span className="dial-small-text">{item.label}</span>}
            onClick={() => onToolToggle(item.id)}
          />
        </li>
      ))}
    </ul>
  </BottomSheetShell>
);
