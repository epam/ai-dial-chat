import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { Button } from '@epam/ai-dial-ui-kit';
import type { CSSProperties, FC, ReactNode } from 'react';
import type { BottomSheetShellColors } from '../BottomSheetShell/BottomSheetShell';
import { BottomSheetShell } from '../BottomSheetShell/BottomSheetShell';
import styles from './BottomSheet.module.scss';

/** Color overrides for the `BottomSheet` component, applied as CSS custom properties. */
export interface BottomSheetColors {
  /** Item label text color. Defaults to `--text-primary`. */
  itemText?: string;
  /** Item hover background. Defaults to `--bg-layer-3`. */
  itemHoverBg?: string;
  /** Item active/pressed background. Defaults to `--bg-layer-4`. */
  itemActiveBg?: string;
  /** Item leading-icon color. Defaults to `--text-secondary`. */
  itemIcon?: string;
  /** Color overrides forwarded to the underlying `BottomSheetShell` (backdrop, panel background, title, divider). */
  shell?: BottomSheetShellColors;
}

/** A single action entry in the bottom-sheet menu. */
export interface BottomSheetItem {
  /** Unique identifier for the item. */
  key: string;
  /** Display label. */
  label: string;
  /** Leading icon element. */
  icon: ReactNode;
  /** Optional trailing icon element. */
  iconAfter?: ReactNode;
  /** CSS class applied to the item button text. Defaults to empty string */
  textClassName?: string;
  /** Invoked when the item is tapped; the sheet closes automatically after. */
  onClick: () => void;
}

/** Props for the generic mobile bottom-sheet menu. */
export interface BottomSheetProps {
  /** Controls sheet visibility. */
  isOpen: boolean;
  /** Heading text rendered in the sheet header. */
  title: string;
  /** Accessible label for the close (×) button. */
  closeLabel: string;
  /** Called when the sheet should close (backdrop tap, close button, or Escape). */
  onClose: () => void;
  /** Inline CSS custom properties forwarded to the sheet root for theming. */
  style?: CSSProperties;
  /** Actions displayed in the sheet body. */
  items: BottomSheetItem[];
  /** Extra classes appended to the sheet container (e.g. a max-height constraint). */
  className?: string;
  /** CSS class applied to the sheet title. Defaults to `'dial-body-semi-bold-text'`. */
  titleClassName?: string;
  /** CSS class applied to each item label. Defaults to `'dial-small-text'`. */
  itemLabelClassName?: string;
  /** CSS class applied to each item button text. Defaults to empty string */
  btnTextClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: BottomSheetColors;
}

/** Generic mobile bottom-sheet overlay with a list of tappable action items. */
export const BottomSheet: FC<BottomSheetProps> = ({
  isOpen,
  title,
  closeLabel,
  onClose,
  style,
  items,
  className,
  titleClassName = 'dial-body-semi-text',
  itemLabelClassName = 'dial-small-text',
  btnTextClassName = '',
  colors,
}) => {
  const handleItemClick = (onClick: () => void) => {
    onClick();
    onClose();
  };

  const cssVars = buildCssVars({
    '--ci-sheet-text': colors?.itemText,
    '--ci-sheet-item-hover': colors?.itemHoverBg,
    '--ci-sheet-item-active': colors?.itemActiveBg,
    '--ci-sheet-icon': colors?.itemIcon,
  });

  return (
    <BottomSheetShell
      isOpen={isOpen}
      title={title}
      closeLabel={closeLabel}
      onClose={onClose}
      style={style}
      className={className}
      titleClassName={titleClassName}
      colors={colors?.shell}
    >
      <ul role="list" className="flex flex-col" style={cssVars}>
        {items.map(({ key, label, icon, iconAfter, onClick }) => (
          <li key={key}>
            <Button
              type="button"
              className={mergeClasses(
                styles.item,
                'w-full gap-3 px-4 py-[10px] text-start',
              )}
              iconBefore={<span className={styles.itemIcon}>{icon}</span>}
              iconAfter={
                iconAfter ? <span className="ms-auto">{iconAfter}</span> : null
              }
              textClassName={btnTextClassName}
              label={<span className={itemLabelClassName}>{label}</span>}
              onClick={() => handleItemClick(onClick)}
            />
          </li>
        ))}
      </ul>
    </BottomSheetShell>
  );
};
