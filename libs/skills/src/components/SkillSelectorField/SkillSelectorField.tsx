import {
  buildCssVars,
  isSkillSelectionUnsupported,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  GhostButton,
  Input,
  Search,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconX } from '@tabler/icons-react';
import { useEffect, useId, useRef, useState, type FC } from 'react';
import { SKILLS_CLASS } from '../../constants/public-class-names';
import type { FavoriteSkillItem } from '../../models/favorite-skill-item';
import type { SkillSelectorFieldProps } from '../../models/skill-selector-field-props';
import { FavoriteSkillsPanel } from '../FavoriteSkillsPanel/FavoriteSkillsPanel';
import { SkillCatalogModal } from '../SkillCatalogModal/SkillCatalogModal';
import styles from './SkillSelectorField.module.scss';

const EMPTY_FAVORITES: FavoriteSkillItem[] = [];

/** Controlled skill input with favorites, catalog browsing, and explicit removal. */
export const SkillSelectorField: FC<SkillSelectorFieldProps> = ({
  value,
  onChange,
  displayName,
  favorites = EMPTY_FAVORITES,
  onToggleFavorite,
  onViewDetails,
  renderOverlay,
  isSkillsSupported,
  isDisabled = false,
  isInvalid = false,
  labelledById,
  describedById,
  labels,
  renderCatalogContent,
  className,
  styles: fieldStyles,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const triggerRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  const unsupported = isSkillSelectionUnsupported(value, isSkillsSupported);
  const canSelect = isSkillsSupported && !isDisabled;
  const open = isOpen && canSelect;
  const catalogOpen = isCatalogOpen && canSelect;
  const focusTrigger = () => {
    if (triggerRef.current && !triggerRef.current.disabled)
      triggerRef.current.focus();
    else
      rootRef.current
        ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
        ?.focus();
  };

  useEffect(() => {
    if (wasOpen.current && !open && !catalogOpen) {
      /* Preserve focus when dismissal activates another field or dialog. */
      if (
        document.activeElement === document.body ||
        rootRef.current?.contains(document.activeElement)
      ) {
        focusTrigger();
      }
      setIsOpen(false);
      setIsCatalogOpen(false);
    }
    wasOpen.current = open || catalogOpen;
  }, [open, catalogOpen]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && !canSelect) return;
    setQuery('');
    setIsOpen(nextOpen);
  };
  const handleSelect = (url: string) => {
    if (canSelect) onChange(url);
    setIsOpen(false);
    setIsCatalogOpen(false);
  };
  const cssVars = {
    ...buildCssVars({
      '--ssf-text': fieldStyles?.colors?.text,
      '--ssf-bg': fieldStyles?.colors?.background,
      '--ssf-border': fieldStyles?.colors?.border,
      '--ssf-error': fieldStyles?.colors?.error,
    }),
    ...fieldStyles?.cssVars,
  };
  const panel = (
    <div id={panelId} className="w-full min-w-0">
      <div className="p-2">
        <Search
          value={query}
          onChange={(nextQuery) => setQuery(nextQuery ?? '')}
          placeholder={labels.searchPlaceholder ?? 'Search skills'}
          aria-label={labels.searchPlaceholder ?? 'Search skills'}
          clearLabel={labels.clearSearchLabel ?? 'Clear search'}
        />
      </div>
      <FavoriteSkillsPanel
        className="min-w-0 desktop:w-full"
        rowClassName="min-h-11"
        favorites={favorites}
        searchQuery={query}
        labels={labels.panelLabels}
        onSelect={(item) => handleSelect(item.id)}
        onToggleFavorite={onToggleFavorite}
        onViewDetails={
          onViewDetails
            ? (item) => {
                setIsOpen(false);
                onViewDetails(item);
              }
            : undefined
        }
        onBrowse={() => {
          setIsOpen(false);
          setIsCatalogOpen(true);
        }}
      />
    </div>
  );
  const trigger = (
    <Input
      inputRef={triggerRef}
      readOnly
      role="combobox"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      aria-labelledby={labelledById}
      aria-describedby={describedById}
      aria-invalid={isInvalid || unsupported}
      disabled={!canSelect}
      invalid={isInvalid || unsupported}
      value={value ? displayName || value : ''}
      placeholder={labels.placeholder}
      title={
        !isSkillsSupported
          ? labels.unsupportedTooltipLabel
          : value
            ? displayName || value
            : undefined
      }
      containerClassName="w-full min-w-0"
      wrapperClassName={mergeClasses(
        'cursor-pointer',
        '--ssf-bg' in cssVars && styles.background,
        '--ssf-border' in cssVars && styles.border,
        (isInvalid || unsupported) && styles.invalid,
        fieldStyles?.triggerClassName,
      )}
      className={mergeClasses(
        'min-w-0 cursor-pointer text-ellipsis',
        '--ssf-text' in cssVars && styles.value,
        fieldStyles?.typography?.fontClassName ?? 'dial-small-text',
      )}
      onKeyDown={(event) => {
        if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          handleOpenChange(event.key === 'ArrowDown' || !open);
        } else if (event.key === 'Escape') {
          handleOpenChange(false);
        }
      }}
      iconAfter={
        <span className="flex shrink-0 items-center">
          {value && (
            <GhostButton
              type="button"
              className={mergeClasses('size-11 shrink-0', styles.clear)}
              disabled={isDisabled}
              aria-label={labels.removeSkillLabel}
              onKeyDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onChange(undefined);
                setIsOpen(false);
                if (canSelect) triggerRef.current?.focus();
                else rootRef.current?.focus();
              }}
              iconBefore={
                <IconX aria-hidden size={18} stroke={DIAL_KIT_ICON_STROKE} />
              }
            />
          )}
          <IconChevronDown
            aria-hidden
            size={20}
            stroke={DIAL_KIT_ICON_STROKE}
            className={mergeClasses(
              'transition-transform',
              open && 'rotate-180',
            )}
          />
        </span>
      }
    />
  );

  return (
    <div
      ref={rootRef}
      role="group"
      aria-labelledby={labelledById}
      tabIndex={-1}
      className={mergeClasses('min-w-0', className, SKILLS_CLASS.selectorField)}
      style={cssVars}
    >
      {renderOverlay ? (
        <>
          {/* Keyboard interaction is handled by the combobox. */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- combobox owns keyboard activation */}
          <div
            className="w-full min-w-0"
            onClick={() => handleOpenChange(!open)}
          >
            {trigger}
          </div>
          {renderOverlay(panel, open, () => handleOpenChange(false))}
        </>
      ) : (
        <Dropdown
          open={open}
          onOpenChange={handleOpenChange}
          disabled={!canSelect}
          className="w-full min-w-0"
          listClassName="w-[min(var(--reference-width),calc(100vw-2rem))] max-w-full"
          renderOverlay={() => (
            <div role="dialog" aria-labelledby={labelledById}>
              {panel}
            </div>
          )}
          initialFocus={0}
        >
          {trigger}
        </Dropdown>
      )}
      {catalogOpen && (
        <SkillCatalogModal
          isOpen
          onClose={() => setIsCatalogOpen(false)}
          title={labels.modalTitle}
          onSelect={handleSelect}
          renderContent={renderCatalogContent}
        />
      )}
    </div>
  );
};
