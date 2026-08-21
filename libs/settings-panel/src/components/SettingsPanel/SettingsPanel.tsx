import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { useId, useRef, type FC, type KeyboardEvent } from 'react';
import type {
  SettingsPanelItem,
  SettingsPanelProps,
} from '../../models/settings-panel-props';
import styles from './SettingsPanel.module.scss';

const findEnabledIndex = (
  items: SettingsPanelItem[],
  fromIndex: number,
  direction: 1 | -1,
): number => {
  const count = items.length;
  for (let step = 1; step <= count; step += 1) {
    const index = (fromIndex + direction * step + count) % count;
    if (!items[index].disabled) return index;
  }
  return fromIndex;
};

const findFirstEnabledIndex = (items: SettingsPanelItem[]): number =>
  items.findIndex((item) => !item.disabled);

const findLastEnabledIndex = (items: SettingsPanelItem[]): number => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (!items[index].disabled) return index;
  }
  return -1;
};

/** Vertical icon + label navigation panel with a roving-tabindex ARIA tablist. */
export const SettingsPanel: FC<SettingsPanelProps> = ({
  items,
  activeId,
  onSelect,
  sectionLabel,
  styles: settingsPanelStyles,
  className,
}) => {
  const headerId = useId();
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  const {
    sectionLabelClassName = 'dial-h1-text',
    itemLabelClassName = 'dial-small-text',
    activeItemLabelClassName = 'dial-small-semi-text',
  } = settingsPanelStyles?.typography ?? {};
  const colors = settingsPanelStyles?.colors;
  const cssVars = buildCssVars({
    '--sp-section-label-text': colors?.sectionLabelText,
    '--sp-row-text': colors?.rowText,
    '--sp-row-bg-hover': colors?.rowBackgroundHover,
    '--sp-active-row-bg': colors?.activeRowBackground,
    '--sp-active-row-bg-hover': colors?.activeRowBackgroundHover,
    '--sp-active-row-text': colors?.activeRowText,
  });

  const activeIndex = items.findIndex((item) => item.id === activeId);

  const focusAndSelect = (index: number) => {
    if (index < 0 || index === activeIndex) return;
    const item = items[index];
    rowRefs.current.get(item.id)?.focus();
    onSelect(item.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusAndSelect(findEnabledIndex(items, activeIndex, 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAndSelect(findEnabledIndex(items, activeIndex, -1));
        break;
      case 'Home':
        event.preventDefault();
        focusAndSelect(findFirstEnabledIndex(items));
        break;
      case 'End':
        event.preventDefault();
        focusAndSelect(findLastEnabledIndex(items));
        break;
      default:
        break;
    }
  };

  return (
    <div
      className={mergeClasses('flex flex-col gap-3 bg-layer-raised', className)}
      style={cssVars}
    >
      {sectionLabel && (
        <div className="flex h-16 shrink-0 items-center px-4">
          <span
            id={headerId}
            className={mergeClasses(styles.sectionLabel, sectionLabelClassName)}
          >
            {sectionLabel}
          </span>
        </div>
      )}
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-labelledby={sectionLabel ? headerId : undefined}
        onKeyDown={handleKeyDown}
        // Roving tabindex lives on the tab buttons; the list itself is never
        // a tab stop, but jsx-a11y requires an interactive role to declare
        // its own (non-reachable) focusability.
        tabIndex={-1}
        className="flex flex-col"
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          const isVisuallyActive = isActive && items.length > 1;
          return (
            <button
              key={item.id}
              ref={(element) => {
                if (element) rowRefs.current.set(item.id, element);
                else rowRefs.current.delete(item.id);
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-disabled={item.disabled || undefined}
              disabled={item.disabled}
              tabIndex={isActive ? 0 : -1}
              onClick={() => {
                if (!item.disabled && !isActive) onSelect(item.id);
              }}
              className={mergeClasses(
                'flex h-11 w-full items-center gap-2 rounded-lg px-3 text-start desktop:h-10',
                'focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-focus-black',
                styles.row,
                isVisuallyActive && styles.rowActive,
              )}
            >
              {item.icon}
              <span
                className={mergeClasses(
                  isVisuallyActive
                    ? activeItemLabelClassName
                    : itemLabelClassName,
                  !isVisuallyActive && 'text-primary',
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
