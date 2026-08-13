import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, Dropdown } from '@epam/ai-dial-ui-kit';
import { IconCheck, IconChevronDown, IconWorld } from '@tabler/icons-react';
import { FC, type KeyboardEvent, type RefObject } from 'react';
import { ShareLinkAccess } from '../../types/share';
import styles from '../SharePopover/SharePopover.module.scss';

/** Props for {@link AccessControl}. */
interface AccessControlProps {
  /** Primary row text, e.g. "Anyone with the link". */
  anyoneWithLinkTitle: string;
  /** Secondary row text, e.g. "in your organization". */
  anyoneWithLinkSubtitle: string;
  /** Current access level(s) for the share link. */
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
  /** CSS class applied to the access trigger label. Defaults to `'dial-small-semi-text'`. */
  accessTriggerLabelClassName?: string;
  /** CSS class applied to each access menu item label. Defaults to `'dial-small-text'`. */
  accessMenuItemLabelClassName?: string;
}

/** "Anyone with the link" row: icon, title/subtitle, and an optional Can view/Can edit access-level control. */
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
  accessMenuItemLabelClassName = 'dial-small-text',
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
        <Dropdown
          matchReferenceWidth={false}
          placement="bottom-end"
          open={isOpen}
          onOpenChange={onOpenChange}
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
                      'flex w-full cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start outline-none',
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
                    <span
                      className={mergeClasses(
                        accessMenuItemLabelClassName,
                        styles.accessMenuItemLabel,
                      )}
                    >
                      {option.label}
                    </span>
                    {isChecked && (
                      <IconCheck
                        size={DIAL_ICON_SIZE.SM}
                        stroke={2}
                        className={styles.accessMenuItemCheck}
                        aria-hidden
                      />
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
              'flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 outline-none',
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
        </Dropdown>
      ) : (
        <span
          aria-label={accessAriaLabel}
          className={mergeClasses(
            'flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg px-2.5',
            styles.accessTriggerBtn,
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
