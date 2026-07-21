import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { GradientCheckIcon } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE, DialDropdown } from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconWorld } from '@tabler/icons-react';
import { FC, type KeyboardEvent, type RefObject } from 'react';
import { ShareLinkAccess } from '../../types/share';
import styles from '../SharePopover/SharePopover.module.scss';

/** Props for {@link AccessControl}. */
interface AccessControlProps {
  /** Primary row text, e.g. "Anyone with the link". */
  anyoneWithLinkTitle: string;
  /** Secondary row text, e.g. "in your organization". */
  anyoneWithLinkSubtitle: string;
  /**
   * Current access levels. Edit access implies view access, so this is
   * `[View, Edit]` rather than `[Edit]` alone.
   */
  access: ShareLinkAccess[];
  /** True to show an interactive dropdown; false shows a static "Can view" label. */
  canEditAccess: boolean;
  /** Access-dropdown option label for view access. */
  accessViewLabel: string;
  /** Access-dropdown option label for edit access. */
  accessEditLabel: string;
  /** `aria-label` for the access-level control. */
  accessAriaLabel: string;
  /** Whether the access dropdown menu is open. */
  isOpen: boolean;
  /** Called when the dropdown open state should change. */
  onOpenChange: (next: boolean) => void;
  /** Called when the user selects a different access level. */
  onAccessChange: (access: ShareLinkAccess[]) => void;
  /** Arrow-key navigation handler for the open menu. */
  onMenuKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  /** Ref attached to the dropdown trigger button, so focus can return to it on close. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  /** Ref attached to the menu container, so the popover's Tab-trap can find its items. */
  menuRef: RefObject<HTMLDivElement | null>;
  /** CSS class applied to the primary row text. Defaults to `'dial-small-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to the secondary row text. Defaults to `'dial-tiny-text'`. */
  subtitleClassName?: string;
  /** CSS class applied to the access trigger label. Defaults to `undefined`. */
  accessTriggerLabelClassName?: string;
}

/**
 * "Anyone with the link" row: an icon, title/subtitle, and either an
 * interactive Can view/Can edit dropdown or a static "Can view" label.
 */
export const AccessControl: FC<AccessControlProps> = ({
  anyoneWithLinkTitle,
  anyoneWithLinkSubtitle,
  access,
  canEditAccess,
  accessViewLabel,
  accessEditLabel,
  accessAriaLabel,
  isOpen,
  onOpenChange,
  onAccessChange,
  onMenuKeyDown,
  triggerRef,
  menuRef,
  titleClassName = 'dial-small-semi-text',
  subtitleClassName = 'dial-tiny-text',
  accessTriggerLabelClassName = 'dial-small-semi-text',
}) => {
  const accessOptions: { value: ShareLinkAccess; label: string }[] = [
    { value: ShareLinkAccess.View, label: accessViewLabel },
    { value: ShareLinkAccess.Edit, label: accessEditLabel },
  ];
  const selectedAccess = access.includes(ShareLinkAccess.Edit)
    ? ShareLinkAccess.Edit
    : ShareLinkAccess.View;

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={mergeClasses(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          styles.linkIconBadge,
        )}
      >
        <IconWorld size={DIAL_ICON_SIZE.MD} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={mergeClasses(
            titleClassName,
            'truncate',
            styles.anyoneWithLinkTitle,
          )}
        >
          {anyoneWithLinkTitle}
        </p>
        <p
          className={mergeClasses(
            subtitleClassName,
            styles.anyoneWithLinkSubtitle,
          )}
        >
          {anyoneWithLinkSubtitle}
        </p>
      </div>
      {canEditAccess ? (
        <DialDropdown
          matchReferenceWidth={false}
          placement="bottom-end"
          open={isOpen}
          onOpenChange={onOpenChange}
          listClassName="cp-dropdown-overlay"
          renderOverlay={() => (
            <div
              ref={menuRef}
              role="menu"
              aria-label={accessAriaLabel}
              tabIndex={-1}
              className="min-w-[160px]"
              onKeyDown={onMenuKeyDown}
            >
              {accessOptions.map((option) => {
                const isChecked = selectedAccess === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isChecked}
                    className={mergeClasses(
                      'flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-start outline-none',
                      styles.accessMenuItem,
                      isChecked && styles.accessMenuItemChecked,
                    )}
                    onClick={() => {
                      onAccessChange(
                        option.value === ShareLinkAccess.Edit
                          ? [ShareLinkAccess.View, ShareLinkAccess.Edit]
                          : [ShareLinkAccess.View],
                      );
                      onOpenChange(false);
                    }}
                  >
                    <span className={styles.accessMenuItemLabel}>
                      {option.label}
                    </span>
                    {isChecked && (
                      <span className="ms-auto flex shrink-0 items-center">
                        <GradientCheckIcon
                          gradientId={`share-access-check-${option.value}`}
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        >
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            className={mergeClasses(
              'flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 outline-none',
              styles.accessTriggerBtn,
              isOpen && styles.accessTriggerBtnOpen,
            )}
          >
            <span
              className={mergeClasses(
                styles.accessTriggerLabel,
                accessTriggerLabelClassName,
              )}
            >
              {
                accessOptions.find((option) => option.value === selectedAccess)
                  ?.label
              }
            </span>
            <IconChevronDown
              size={14}
              strokeWidth={2.2}
              className={mergeClasses(
                'shrink-0 transition-transform duration-150 rtl:scale-x-[-1]',
                styles.accessTriggerChevron,
                isOpen && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        </DialDropdown>
      ) : (
        <span
          aria-label={accessAriaLabel}
          className={mergeClasses(
            'flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg px-2.5',
            styles.accessStaticLabel,
          )}
        >
          <span
            className={mergeClasses(
              styles.accessTriggerLabel,
              accessTriggerLabelClassName,
            )}
          >
            {accessViewLabel}
          </span>
        </span>
      )}
    </div>
  );
};
