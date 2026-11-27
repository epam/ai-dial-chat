import {
  buildCssVars,
  mergeClasses,
  SELECT_LIST_MAX_HEIGHT_CLASS_NAME,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  DropdownOverlayRole,
  ElementSize,
  GhostIconButton,
  LinkButton,
  MenuItem,
  MenuItemMark,
} from '@epam/ai-dial-ui-kit';
import { IconFilter2 } from '@tabler/icons-react';
import {
  FC,
  KeyboardEvent,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ToolbarTypography } from '../../models/toolbar-props';
import { toggleTopic } from '../../utils/catalog-filter';
import styles from './Filter.module.scss';

/** Color overrides for `Filter`, applied as CSS custom properties. */
export interface FilterColors {
  /** Filter icon color in the trigger button. Fallback: `--text-secondary`. */
  buttonFunnel?: string;
  /** Dot on the trigger while a topic is applied. Fallback: `--bg-control-accent`. */
  activeDot?: string;
  /** Dropdown overlay background. Fallback: `--bg-layer-raised`. */
  overlayBackground?: string;
  /** Dropdown overlay border color. Fallback: `--stroke-tertiary`. */
  overlayBorder?: string;
  /** Dropdown overlay shadow color. Fallback: `--shadow-lg`. */
  overlayShadow?: string;
  /** Row label text color. Fallback: `--text-primary`. */
  rowLabel?: string;
  /** Section heading ("Topics") text color. Fallback: `--text-tertiary`. */
  sectionLabel?: string;
}

/** Props for Filter. */
export interface FilterProps {
  /** Set of topic strings currently selected for filtering. Empty = no topic filter. */
  checked: Set<string>;
  /** Called with the new selection on every toggle and on "Clear all". */
  onChange: (checked: Set<string>) => void;
  /** All available topic strings shown as checkboxes. */
  values?: Set<string>;
  /** Heading of the overlay and its accessible name. Default: 'Topics'. */
  topicsLabel?: string;
  /** Accessible name and tooltip of the icon-only trigger. Default: 'Filter by topic'. */
  triggerLabel?: string;
  /** Text of the header button that clears every topic. Default: 'Clear all'. */
  clearAllLabel?: string;
  /** Ref to the trigger button, e.g. so applied-topic tags can return focus to it. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
  /** Optional typography overrides for the rows and section label. */
  typography?: ToolbarTypography;
  /** Color overrides applied as CSS custom properties. */
  colors?: FilterColors;
}

/** Icon-only topic filter whose dropdown applies each toggle immediately. */
export const Filter: FC<FilterProps> = ({
  checked,
  onChange,
  values,
  topicsLabel = 'Topics',
  triggerLabel = 'Filter by topic',
  clearAllLabel = 'Clear all',
  triggerRef: externalTriggerRef,
  typography,
  colors,
}) => {
  const isActive = checked.size > 0;
  const [isOpen, setIsOpen] = useState(false);

  /* Applied to the trigger and the overlay separately — the dropdown portals
   * its overlay, so it is not a DOM descendant of the trigger. */
  const cssVars = buildCssVars({
    '--cat-filter-btn-funnel': colors?.buttonFunnel,
    '--cat-filter-active-dot': colors?.activeDot,
    '--cat-filter-overlay-bg': colors?.overlayBackground,
    '--cat-filter-overlay-border': colors?.overlayBorder,
    '--cat-filter-overlay-shadow': colors?.overlayShadow,
    '--cat-filter-row-label': colors?.rowLabel,
    '--cat-filter-section-label': colors?.sectionLabel,
  });

  const topics = useMemo(
    () => (values != null ? [...values].sort() : []),
    [values],
  );

  /* Roving tabindex across the topic rows; "Clear all" sits in the header,
   * outside the roving group, in the natural tab order. */
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const internalTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = externalTriggerRef ?? internalTriggerRef;

  const focusRow = useCallback(
    (index: number) => {
      if (topics.length === 0) return;
      const clamped = (index + topics.length) % topics.length;
      setFocusedIndex(clamped);
      rowRefs.current[clamped]?.focus();
    },
    [topics.length],
  );

  // Focus the first row after the overlay renders.
  useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1);
      return;
    }
    const frame = requestAnimationFrame(() => focusRow(0));
    return () => cancelAnimationFrame(frame);
  }, [isOpen, focusRow]);

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' && !isOpen) {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  // The kit Dropdown owns Escape, outside presses and focus return.
  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusRow(focusedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusRow(focusedIndex - 1);
    }
  };

  const handleClearAll = () => onChange(new Set());

  return (
    /* The button must be the Dropdown's direct child, which receives the
       kit's aria-haspopup/aria-controls; the dot sits beside it. */
    <span className="relative inline-flex shrink-0" style={cssVars}>
      <Dropdown
        matchReferenceWidth={false}
        placement="bottom-end"
        open={isOpen}
        onOpenChange={setIsOpen}
        listClassName="!bg-transparent !shadow-none !p-0"
        /* A dialog, not a menu: the panel holds a header with "Clear all" plus
         the checkbox menu. The roving handler below owns the arrow keys. */
        overlayRole={DropdownOverlayRole.Dialog}
        overlayAriaLabel={topicsLabel}
        optionArrowNavigation={false}
        // The effect below focuses the first row; the kit must not move focus.
        initialFocus={-1}
        renderOverlay={() => (
          <div
            tabIndex={-1}
            /*
             * Bound to the kit Dropdown's live available-height var so the
             * topics list, not the floating panel, absorbs a height constraint.
             * The -8px accounts for this overlay's p-[6px] plus the border.
             */
            style={{
              ...cssVars,
              maxHeight: 'calc(var(--fui-available-height, 9999px) - 8px)',
            }}
            className={mergeClasses(
              'flex min-w-[360px] flex-col rounded-xl p-[6px]',
              styles.overlay,
            )}
          >
            <div className="flex shrink-0 items-center gap-2 px-[10px] pt-[6px] pb-1">
              <span
                className={mergeClasses(
                  typography?.filterSectionLabelClassName ??
                    'dial-tiny-lead-semi-text',
                  styles.sectionLabel,
                )}
                aria-hidden
              >
                {topicsLabel}
              </span>
              <LinkButton
                label={clearAllLabel}
                className="ms-auto"
                disabled={!isActive}
                onClick={handleClearAll}
              />
            </div>
            {/* The rows are their own scroll box so the header stays put. */}
            <div
              role="menu"
              aria-label={topicsLabel}
              className={mergeClasses(
                SELECT_LIST_MAX_HEIGHT_CLASS_NAME,
                'flex min-h-0 flex-col gap-1 overflow-y-auto',
              )}
              onKeyDown={handleMenuKeyDown}
            >
              {topics.map((topic, idx) => {
                const isChecked = checked.has(topic);
                return (
                  <MenuItem
                    key={topic}
                    role="menuitemcheckbox"
                    aria-checked={isChecked}
                    mark={MenuItemMark.Checkbox}
                    selected={isChecked}
                    label={topic}
                    labelClassName={mergeClasses(
                      styles.rowLabel,
                      typography?.filterButtonClassName,
                    )}
                    className="shrink-0"
                    tabIndex={focusedIndex === idx ? 0 : -1}
                    ref={(el) => {
                      rowRefs.current[idx] = el;
                    }}
                    onFocus={() => setFocusedIndex(idx)}
                    onClick={() => onChange(toggleTopic(topic, checked))}
                  />
                );
              })}
            </div>
          </div>
        )}
      >
        <GhostIconButton
          ref={triggerRef}
          size={ElementSize.Large}
          aria-label={triggerLabel}
          tooltipProps={{ tooltip: triggerLabel }}
          aria-expanded={isOpen}
          onKeyDown={handleTriggerKeyDown}
          icon={
            <IconFilter2
              size={DIAL_ICON_SIZE.LG}
              stroke={DIAL_KIT_ICON_STROKE}
              className={styles.filterBtnFunnel}
              aria-hidden
            />
          }
        />
      </Dropdown>
      {isActive && (
        <span
          className={mergeClasses(
            'pointer-events-none absolute inset-e-2.5 top-2.5 size-2 rounded-full',
            styles.activeDot,
          )}
          aria-hidden
        />
      )}
    </span>
  );
};
