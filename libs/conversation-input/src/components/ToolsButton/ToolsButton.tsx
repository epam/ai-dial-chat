import {
  buildCssVars,
  mergeClasses,
  type ToolMenuItem,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
import {
  Button,
  ButtonAppearance,
  DIAL_ICON_SIZE,
  Dropdown,
  ElementSize,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconTool } from '@tabler/icons-react';
import { type CSSProperties, type FC, useMemo, useState } from 'react';
import { buildToolMenuItems } from '../../utils/tools-menu';
import { ToolsBottomSheet } from '../ToolsBottomSheet/ToolsBottomSheet';
import styles from './ToolsButton.module.scss';

/** Color overrides for `ToolsButton`, applied as CSS custom properties with app theme fallbacks. */
export interface ToolsButtonColors {
  /** Trigger icon color. Fallback: `--text-secondary`. */
  triggerIcon?: string;
  /** Selected-tools count color on the trigger. Fallback: `--text-accent`. */
  countText?: string;
  /** Icon color for each tool row in the menu. Fallback: `--text-secondary`. */
  toolIcon?: string;
  /** Checkmark color for a selected tool row. Fallback: `--text-accent`. */
  selectedToolIcon?: string;
}

/** Props for the ToolsButton component. */
export interface ToolsButtonProps {
  /** Resolved tool toggle items rendered in the menu. */
  items: ToolMenuItem[];
  /** Called with the tool id when a tool row is toggled. */
  onToolToggle: (toolId: string) => void;
  /** Visible label, tooltip, and mobile sheet title. Defaults to `'Tools'`. */
  label?: string;
  /** Accessible label for the close (x) button of the mobile sheet. Defaults to `'Close'`. */
  closeLabel?: string;
  /** Screen-reader-only text marking a selected tool row. Defaults to `'Selected'`. */
  selectedStateLabel?: string;
  /** Formats the selected-tools count appended to the trigger's accessible name. Defaults to English pluralization. */
  countLabel?: (count: number) => string;
  /** When `true`, the trigger is disabled and the menu cannot open. Defaults to `false`. */
  isDisabled?: boolean;
  /** CSS custom-property overrides forwarded to the mobile bottom sheet. */
  style?: CSSProperties;
  /** Width class applied to the desktop dropdown list. Defaults to `'w-[240px]'`. */
  listClassName?: string;
  /** Typography utility class applied to the trigger label. Defaults to `'dial-small-text'`. */
  labelClassName?: string;
  /** Color overrides. */
  colors?: ToolsButtonColors;
}

const defaultCountLabel = (count: number): string =>
  `${count} tool${count !== 1 ? 's' : ''} selected`;

/** Permanent Tools control in the conversation input action bar: a desktop dropdown of tool toggles, or a bottom sheet on mobile. */
export const ToolsButton: FC<ToolsButtonProps> = ({
  items,
  onToolToggle,
  label = 'Tools',
  closeLabel = 'Close',
  selectedStateLabel = 'Selected',
  countLabel = defaultCountLabel,
  isDisabled = false,
  style,
  listClassName = 'w-[240px]',
  labelClassName = 'dial-small-text',
  colors,
}) => {
  const isMobile = useIsMobile();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const cssVars = useMemo(
    () =>
      buildCssVars({
        '--tb-icon': colors?.triggerIcon,
        '--tb-count-text': colors?.countText,
        '--tb-tool-icon': colors?.toolIcon,
        '--tb-selected-tool-icon': colors?.selectedToolIcon,
      }),
    [colors],
  );

  const menuItems = useMemo(
    () =>
      buildToolMenuItems({
        items,
        onToolToggle,
        selectedStateLabel,
        style: cssVars,
        iconClassName: styles.toolIcon,
        selectedIconClassName: styles.selectedToolIcon,
      }),
    [items, onToolToggle, selectedStateLabel, cssVars],
  );

  if (items.length === 0) return null;

  const selectedCount = items.filter((item) => item.isSelected).length;

  /*
   * The visible label stays part of the accessible name (WCAG "Label in Name"),
   * with the count appended as a full phrase so screen readers announce
   * "Tools, 2 tools selected" rather than a bare digit.
   */
  const triggerAriaLabel =
    selectedCount > 0 ? `${label}, ${countLabel(selectedCount)}` : label;

  const toolIcon = (
    <IconTool
      size={DIAL_ICON_SIZE.LG}
      className={styles.icon}
      style={cssVars}
      aria-hidden
    />
  );

  if (isMobile) {
    return (
      <>
        <GhostIconButton
          icon={toolIcon}
          aria-label={triggerAriaLabel}
          size={ElementSize.Large}
          tooltipProps={{ tooltip: label }}
          disabled={isDisabled}
          onClick={() => setIsSheetOpen(true)}
        />
        <ToolsBottomSheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          closeLabel={closeLabel}
          style={style}
          title={label}
          items={items}
          onToolToggle={onToolToggle}
        />
      </>
    );
  }

  return (
    <Dropdown
      matchReferenceWidth={false}
      placement="bottom-start"
      listClassName={listClassName}
      items={menuItems}
      open={isMenuOpen}
      onOpenChange={setIsMenuOpen}
      disabled={isDisabled}
    >
      <Button
        appearance={ButtonAppearance.Ghost}
        size={ElementSize.Large}
        className="flex-shrink-0 rounded-full"
        iconBefore={toolIcon}
        /* A ReactNode label keeps `aria-label` as the accessible name, so the selected count is announced. */
        label={<span>{label}</span>}
        textClassName={labelClassName}
        iconAfter={
          selectedCount > 0 ? (
            <span
              style={cssVars}
              className={mergeClasses(styles.count, labelClassName)}
              aria-hidden
            >
              {selectedCount}
            </span>
          ) : undefined
        }
        aria-label={triggerAriaLabel}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        disabled={isDisabled}
      />
    </Dropdown>
  );
};
