import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialDropdown,
  PrimaryButton,
  GhostButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconFilter } from '@tabler/icons-react';
import {
  FC,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ToolbarTypography } from '../../models/toolbar-props';
import { getFromLabel } from '../../utils/catalog-filter';
import styles from './Filter.module.scss';

/** Props for Filter. */
/** Color overrides for `Filter`, applied as CSS custom properties. */
export interface FilterColors {
  /** Trigger button background. Fallback: `#ffffff`. */
  buttonBackground?: string;
  /** Trigger button border color while the dropdown has focus. Fallback: `--stroke-info`. */
  buttonBorderFocus?: string;
  /** Trigger button border color while a filter is applied. Fallback: `--stroke-info`. */
  buttonBorderActive?: string;
  /** Trigger button border color while the dropdown is open. Fallback: `--stroke-info`. */
  buttonBorderOpen?: string;
  /** Trigger button label color. Fallback: `--text-primary`. */
  buttonLabel?: string;
  /** Funnel icon color in the trigger button. Fallback: `--text-secondary`. */
  buttonFunnel?: string;
  /** Chevron icon color in the trigger button. Fallback: `--text-tertiary`. */
  buttonChevron?: string;
  /** Dropdown overlay background. Fallback: `#ffffff`. */
  overlayBackground?: string;
  /** Row background on hover. Fallback: `--bg-layer-raised`. */
  rowHoverBackground?: string;
  /** Background of a checked row. Fallback: `--bg-accent-primary-alpha`. */
  rowCheckedBackground?: string;
  /** Row label text color. Fallback: `--text-primary`. */
  rowLabel?: string;
  /** Checkbox border color in its unchecked state. Fallback: `--stroke-tertiary`. */
  checkboxBorder?: string;
  /** Checkbox background in its unchecked state. Fallback: `#ffffff`. */
  checkboxBackground?: string;
  /** Section heading ("Topics") text color. Fallback: `--text-tertiary`. */
  sectionLabel?: string;
}

export interface FilterProps {
  /** Set of topic strings currently selected for filtering. Empty = no topic filter. */
  checked: Set<string>;
  /** Called when the topic selection changes. */
  onChange: (checked: Set<string>) => void;
  /** All available topic strings shown as checkboxes. */
  values?: Set<string>;
  /** Whether the "My Apps" filter checkbox is active. */
  isMyAppsActive?: boolean;
  /** Called when the "My Apps" toggle changes. */
  onMyAppsChange?: (isActive: boolean) => void;
  /** Label for the "My Apps" checkbox. Default: 'My'. */
  myAppsLabel?: string;
  /** Label for the Topics section heading. Default: 'Topics'. */
  topicsLabel?: string;
  /** Button label when nothing is filtered. Default: 'From'. */
  defaultLabel?: string;
  /** Label for the footer Clear button. Default: 'Clear'. */
  clearLabel?: string;
  /** Label for the footer Apply button. Default: 'Apply'. */
  applyLabel?: string;
  /** Optional typography overrides for the filter button and section label. */
  typography?: ToolbarTypography;
  /** Color overrides applied as CSS custom properties. */
  colors?: FilterColors;
}

const getFilterButtonLabel = (
  checked: Set<string>,
  values: Set<string> | undefined,
  isMyAppsActive: boolean | undefined,
  myAppsLabel: string,
  defaultLabel: string,
): string => {
  const hasTopics = checked.size > 0;
  if (isMyAppsActive && hasTopics) return `${myAppsLabel} · ${checked.size}`;
  if (isMyAppsActive) return myAppsLabel;
  if (hasTopics) return getFromLabel(checked, values, defaultLabel);
  return defaultLabel;
};

const toggleTopic = (topic: string, checked: Set<string>): Set<string> => {
  const next = new Set(checked);
  if (next.has(topic)) {
    next.delete(topic);
  } else {
    next.add(topic);
  }
  return next;
};

/** Source-filter dropdown: checkbox list for topics and My Apps toggle, with buffered Clear/Apply controls. */
export const Filter: FC<FilterProps> = ({
  checked,
  onChange,
  values,
  isMyAppsActive,
  onMyAppsChange,
  myAppsLabel = 'My',
  topicsLabel = 'Topics',
  defaultLabel = 'From',
  clearLabel = 'Clear',
  applyLabel = 'Apply',
  typography,
  colors,
}) => {
  const isActive = (isMyAppsActive ?? false) || checked.size > 0;
  const [isOpen, setIsOpen] = useState(false);

  /* Applied to the trigger and the overlay separately — the dropdown portals
   * its overlay, so it is not a DOM descendant of the trigger. */
  const cssVars = buildCssVars({
    '--cat-filter-btn-bg': colors?.buttonBackground,
    '--cat-filter-btn-border-focus': colors?.buttonBorderFocus,
    '--cat-filter-btn-border-active': colors?.buttonBorderActive,
    '--cat-filter-btn-border-open': colors?.buttonBorderOpen,
    '--cat-filter-btn-label': colors?.buttonLabel,
    '--cat-filter-btn-funnel': colors?.buttonFunnel,
    '--cat-filter-btn-chevron': colors?.buttonChevron,
    '--cat-filter-overlay-bg': colors?.overlayBackground,
    '--cat-filter-row-hover-bg': colors?.rowHoverBackground,
    '--cat-filter-row-checked-bg': colors?.rowCheckedBackground,
    '--cat-filter-row-label': colors?.rowLabel,
    '--cat-filter-checkbox-border': colors?.checkboxBorder,
    '--cat-filter-checkbox-bg': colors?.checkboxBackground,
    '--cat-filter-section-label': colors?.sectionLabel,
  });

  const topics = useMemo(
    () => (values != null ? [...values].sort() : []),
    [values],
  );

  const buttonLabel = getFilterButtonLabel(
    checked,
    values,
    isMyAppsActive,
    myAppsLabel,
    defaultLabel,
  );

  // Pending (buffered) state — committed to parent only on Apply.
  const [pendingChecked, setPendingChecked] = useState<Set<string>>(
    () => new Set(checked),
  );
  const [pendingMyApps, setPendingMyApps] = useState(isMyAppsActive ?? false);

  // Sync pending from applied state each time the dropdown opens.
  useEffect(() => {
    if (!isOpen) return;
    setPendingChecked(new Set(checked));
    setPendingMyApps(isMyAppsActive ?? false);
  }, [isOpen, checked, isMyAppsActive]);

  /*
   * Keyboard navigation — roving tabindex across checkbox rows only.
   * Footer buttons live outside the roving group (natural tab order).
   */
  const totalItems = topics.length + 1;
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const focusRow = useCallback(
    (index: number) => {
      const clamped = (index + totalItems) % totalItems;
      setFocusedIndex(clamped);
      rowRefs.current[clamped]?.focus();
    },
    [totalItems],
  );

  // Focus first row after overlay renders.
  useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1);
      return;
    }
    const frame = requestAnimationFrame(() => focusRow(0));
    return () => cancelAnimationFrame(frame);
  }, [isOpen, focusRow]);

  const handleOpenChange = (next: boolean) => {
    setIsOpen(next);
    if (!next) triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' && !isOpen) {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  /*
   * Arrow keys navigate checkbox rows; Escape closes. Footer buttons stop
   * propagation of Arrow keys so they don't accidentally move row focus.
   */
  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusRow(focusedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusRow(focusedIndex - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  const makeRowKeyDown =
    (toggle: () => void) => (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      }
    };

  const handleApply = () => {
    onChange(pendingChecked);
    onMyAppsChange?.(pendingMyApps);
    handleOpenChange(false);
  };

  const handleClear = () => {
    onChange(new Set());
    onMyAppsChange?.(false);
    handleOpenChange(false);
  };

  return (
    <DialDropdown
      matchReferenceWidth={false}
      placement="bottom-start"
      open={isOpen}
      onOpenChange={handleOpenChange}
      listClassName="!bg-transparent !shadow-none !p-0"
      renderOverlay={() => (
        <div
          role="menu"
          aria-label={defaultLabel}
          tabIndex={-1}
          style={cssVars}
          className={mergeClasses(
            'min-w-[360px] rounded-xl p-[6px]',
            styles.overlay,
          )}
          onKeyDown={handleMenuKeyDown}
        >
          {/* My Apps row */}
          <div
            role="menuitemcheckbox"
            aria-checked={pendingMyApps}
            tabIndex={focusedIndex === 0 ? 0 : -1}
            ref={(el) => {
              rowRefs.current[0] = el;
            }}
            className={mergeClasses(
              'flex cursor-pointer select-none items-center gap-3 rounded-lg px-[10px] py-[9px] outline-none',
              styles.row,
              pendingMyApps && styles.rowChecked,
            )}
            onClick={() => setPendingMyApps(!pendingMyApps)}
            onKeyDown={makeRowKeyDown(() => setPendingMyApps(!pendingMyApps))}
          >
            <span
              className={mergeClasses(
                'flex size-5 shrink-0 items-center justify-center rounded-md',
                styles.checkbox,
                pendingMyApps && styles.checkboxChecked,
              )}
              aria-hidden
            />
            <span
              className={mergeClasses(
                styles.rowLabel,
                typography?.filterButtonClassName ?? 'dial-small-semi-text',
              )}
            >
              {myAppsLabel}
            </span>
          </div>

          {topics.length > 0 && (
            <>
              <div
                role="separator"
                className={mergeClasses('my-1 h-px', styles.divider)}
                aria-hidden
              />
              <div
                className={mergeClasses(
                  'px-[10px] pb-1 pt-[10px] uppercase tracking-[0.06em]',
                  typography?.filterSectionLabelClassName ??
                    'dial-tiny-semi-text',
                  styles.sectionLabel,
                )}
                aria-hidden
              >
                {topicsLabel}
              </div>
              <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto">
                {topics.map((topic, i) => {
                  const isChecked = pendingChecked.has(topic);
                  const idx = i + 1;
                  const toggle = () =>
                    setPendingChecked(toggleTopic(topic, pendingChecked));
                  return (
                    <div
                      key={topic}
                      role="menuitemcheckbox"
                      aria-checked={isChecked}
                      tabIndex={focusedIndex === idx ? 0 : -1}
                      ref={(el) => {
                        rowRefs.current[idx] = el;
                      }}
                      className={mergeClasses(
                        'flex cursor-pointer select-none items-center gap-3 rounded-lg px-[10px] py-[9px] outline-none',
                        styles.row,
                        isChecked && styles.rowChecked,
                      )}
                      onClick={toggle}
                      onKeyDown={makeRowKeyDown(toggle)}
                    >
                      <span
                        className={mergeClasses(
                          'flex size-5 shrink-0 items-center justify-center rounded-md',
                          styles.checkbox,
                          isChecked && styles.checkboxChecked,
                        )}
                        aria-hidden
                      />
                      <span className={styles.rowLabel}>{topic}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div
            className={mergeClasses(
              'mt-1 flex items-center px-1 py-3',
              styles.footer,
            )}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.stopPropagation();
              }
            }}
          >
            <GhostButton label={clearLabel} onClick={handleClear} />

            <PrimaryButton
              label={applyLabel}
              className="ms-auto"
              onClick={handleApply}
            />
          </div>
        </div>
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onKeyDown={handleTriggerKeyDown}
        style={cssVars}
        className={mergeClasses(
          'flex h-[50px] shrink-0 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-xl px-[18px]',
          styles.filterBtn,
          isActive && styles.filterBtnActive,
          isOpen && styles.filterBtnOpen,
        )}
      >
        <IconFilter
          size={DIAL_ICON_SIZE.SM}
          strokeWidth={1.8}
          className={mergeClasses('shrink-0', styles.filterBtnFunnel)}
          aria-hidden
        />
        <span
          className={mergeClasses(
            styles.filterBtnLabel,
            typography?.filterButtonClassName ?? 'dial-small-semi-text',
          )}
        >
          {buttonLabel}
        </span>
        <IconChevronDown
          size={14}
          strokeWidth={2.2}
          className={mergeClasses(
            'shrink-0 transition-transform duration-150',
            styles.filterBtnChevron,
            isOpen && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
    </DialDropdown>
  );
};
