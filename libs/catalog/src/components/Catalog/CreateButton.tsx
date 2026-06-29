import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialPrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconPlus } from '@tabler/icons-react';
import { FC, KeyboardEvent, useCallback, useRef, useState } from 'react';
import type { CreateOption } from '../../models/catalog-props';
import styles from './CreateButton.module.scss';

/** Props for the catalog Create button. */
export interface CreateButtonProps {
  /** Button label. */
  label: string;
  /**
   * When provided, the button opens a dropdown with these options instead of
   * calling `onClick` directly.
   */
  options?: CreateOption[];
  /** Called when the button is clicked and no `options` are present. */
  onClick?: () => void;
}

/** Renders either a plain primary button or a split-chevron dropdown. */
export const CreateButton: FC<CreateButtonProps> = ({
  label,
  options,
  onClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const returnFocusToTrigger = useCallback(() => {
    containerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) returnFocusToTrigger();
    },
    [returnFocusToTrigger],
  );

  const focusItem = useCallback(
    (index: number) => {
      const count = options?.length ?? 0;
      if (count === 0) return;
      const clamped = ((index % count) + count) % count;
      itemRefs.current[clamped]?.focus();
    },
    [options],
  );

  const handleTriggerKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        // Defer so the overlay has rendered before we try to focus.
        setTimeout(() => focusItem(0), 0);
      }
    },
    [focusItem],
  );

  const handleMenuKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const activeIndex = itemRefs.current.findIndex(
        (ref) => ref === document.activeElement,
      );
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusItem(activeIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusItem(activeIndex <= 0 ? 0 : activeIndex - 1);
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        handleOpenChange(false);
      }
    },
    [focusItem, handleOpenChange],
  );

  if (!options?.length) {
    return (
      <DialPrimaryButton
        label={label}
        iconBefore={<IconPlus size={DIAL_ICON_SIZE.SM} />}
        onClick={onClick}
        className={styles.gradientBtn}
      />
    );
  }

  return (
    <div ref={containerRef}>
      <DialDropdown
        open={isOpen}
        onOpenChange={handleOpenChange}
        matchReferenceWidth={false}
        placement="bottom-end"
        outsideClosable
        listClassName={styles.dropdownWrapper}
        renderOverlay={() => (
          <div
            role="menu"
            aria-label={label}
            className={styles.menu}
            onKeyDown={handleMenuKeyDown}
          >
            <div
              className={mergeClasses(
                styles.menuCaption,
                'dial-tiny-semi-text',
              )}
            >
              Create new
            </div>

            {options.map((opt, i) => (
              <button
                key={String(i)}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                role="menuitem"
                tabIndex={-1}
                className={styles.item}
                onClick={() => {
                  opt.onClick();
                  handleOpenChange(false);
                }}
                onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    opt.onClick();
                    handleOpenChange(false);
                  }
                }}
              >
                {opt.icon && (
                  <div
                    className={mergeClasses(
                      styles.itemIcon,
                      opt.iconContainerClassName,
                    )}
                  >
                    {opt.icon}
                  </div>
                )}

                <div className={styles.itemText}>
                  <span
                    className={mergeClasses(
                      styles.itemLabel,
                      'dial-small-semi-text',
                    )}
                  >
                    {opt.label}
                  </span>
                  {opt.description && (
                    <span
                      className={mergeClasses(
                        styles.itemDescription,
                        'dial-tiny-text',
                      )}
                    >
                      {opt.description}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      >
        <DialPrimaryButton
          label={label}
          iconBefore={<IconPlus size={DIAL_ICON_SIZE.SM} />}
          iconAfter={
            <span className="flex items-center gap-2">
              <span className={styles.splitDivider} />
              <IconChevronDown
                size={DIAL_ICON_SIZE.SM}
                className={mergeClasses(
                  styles.chevron,
                  isOpen && styles.chevronOpen,
                )}
              />
            </span>
          }
          className={styles.gradientBtn}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onKeyDown={handleTriggerKeyDown}
        />
      </DialDropdown>
    </div>
  );
};
