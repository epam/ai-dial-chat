import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  type DropdownItem,
  InlineSelect,
  MenuItemMark,
} from '@epam/ai-dial-ui-kit';
import { IconWorld } from '@tabler/icons-react';
import { type CSSProperties, FC } from 'react';
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
  /** Inline style for the menu panel, which renders in a portal outside the popover — the channel for its custom properties. */
  menuStyle?: CSSProperties;
  /** CSS class applied to the primary row text. Defaults to `'dial-small-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to the secondary row text. Defaults to `'dial-small-text'`. */
  subtitleClassName?: string;
  /** CSS class applied to the access trigger label. Defaults to `'dial-small-semi-text'`. */
  accessTriggerLabelClassName?: string;
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
  menuStyle,
  titleClassName = 'dial-small-semi-text',
  subtitleClassName = 'dial-small-text',
  accessTriggerLabelClassName = 'dial-small-semi-text',
}) => {
  const selectedAccess = access.includes(ShareLinkAccess.Edit)
    ? ShareLinkAccess.Edit
    : ShareLinkAccess.View;

  /* One choice out of the list, which the design marks with a trailing check;
     the kit renders a checked `Check` item as a `menuitemradio`. */
  const accessItems: DropdownItem[] = [
    { key: ShareLinkAccess.View, label: accessViewLabel },
    { key: ShareLinkAccess.Edit, label: accessEditLabel },
  ].map((item) => ({
    ...item,
    mark: MenuItemMark.Check,
    checked: item.key === selectedAccess,
    className: styles.accessMenuItem,
  }));

  const handleAccessSelect = ({ key }: { key: string }) => {
    onAccessChange(
      key === ShareLinkAccess.Edit
        ? [ShareLinkAccess.View, ShareLinkAccess.Edit]
        : [ShareLinkAccess.View],
    );
  };

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={mergeClasses(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          styles.linkIconBadge,
        )}
      >
        <IconWorld
          size={DIAL_ICON_SIZE.MD}
          aria-hidden
          stroke={DIAL_KIT_ICON_STROKE}
        />
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
        /* The pill is the kit trigger restyled: its border, fill and label
           colour come from the popover's custom properties, and its open
           border follows `aria-expanded`. Open state is controlled so the
           popover can close the menu on Escape without closing itself. */
        <InlineSelect
          items={accessItems}
          selectedKey={selectedAccess}
          onSelect={handleAccessSelect}
          open={isOpen}
          onOpenChange={onOpenChange}
          placement="bottom-end"
          matchReferenceWidth={false}
          listClassName="min-w-[160px]"
          listStyle={menuStyle}
          triggerClassName={mergeClasses(
            'shrink-0 gap-1.5 whitespace-nowrap border',
            styles.accessTriggerBtn,
          )}
          triggerLabelClassName={mergeClasses(
            styles.accessTriggerLabel,
            accessTriggerLabelClassName,
          )}
        />
      ) : (
        <span
          aria-label={accessAriaLabel}
          className={mergeClasses(
            'flex h-10 shrink-0 items-center whitespace-nowrap rounded-full px-3',
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
