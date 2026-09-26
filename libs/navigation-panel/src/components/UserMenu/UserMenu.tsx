import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Button,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  DropdownItemType,
  EllipsisTooltip,
  MenuItemMark,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import { IconLogout, IconSettings } from '@tabler/icons-react';
import { memo, useMemo, type FC } from 'react';
import type { UserMenuProps } from '../../models/user-menu-props';
import { AvatarInitials } from '../common/AvatarInitials';
import { UserAvatar } from '../common/UserAvatar';
import styles from './UserMenu.module.scss';

/**
 * Avatar trigger pinned to the bottom of the nav rail, opening a dropdown with
 * the user's identity, single-select settings submenus, and a log-out entry.
 */
export const UserMenu: FC<UserMenuProps> = memo(
  ({
    profile,
    labels,
    groups,
    onLogout,
    onSettings,
    isTooltipHidden,
    styles: menuStyles,
  }) => {
    const { colors, typography, className, cssVars } = menuStyles ?? {};
    const labelClassName = typography?.fontClassName ?? 'dial-small-text';

    const menuCssVars = useMemo(
      () =>
        buildCssVars({
          '--np-avatar-bg': colors?.avatarBackground,
          '--np-avatar-text': colors?.avatarText,
          '--np-menu-text': colors?.text,
          '--np-trigger-hover-bg': colors?.triggerHoverBackground,
          '--np-font-family': typography?.fontFamily,
        }),
      [colors, typography?.fontFamily],
    );

    const menuLabelClassName = useMemo(
      () => mergeClasses(styles.menuLabel, labelClassName),
      [labelClassName],
    );

    const items = useMemo<DropdownItem[]>(() => {
      const groupItems = (groups ?? [])
        .filter(({ options }) => options.length > 0)
        .map(({ id, label, icon, options }) => ({
          key: id,
          label: <span className={menuLabelClassName}>{label}</span>,
          icon,
          children: options.map((option) => ({
            key: option.id,
            label: <span className={menuLabelClassName}>{option.label}</span>,
            icon: option.icon,
            /* The applied value is the menu's single choice, so the kit draws
               the trailing check and announces the row as a radio item. */
            mark: MenuItemMark.Check,
            checked: option.isActive,
            onClick: option.onSelect,
          })),
        }));

      return [
        {
          key: 'identity',
          type: DropdownItemType.PlainText,
          label: (
            <div className="flex h-[40px] min-w-0 items-center gap-3">
              <AvatarInitials shortName={profile.shortName} />
              <EllipsisTooltip
                text={profile.displayName}
                className={mergeClasses(
                  styles.identityText,
                  labelClassName,
                  'min-w-0 flex-1 truncate',
                )}
              />
            </div>
          ),
        },
        ...groupItems,
        { key: 'divider-1', type: DropdownItemType.Divider },
        ...(onSettings
          ? [
              {
                key: 'settings',
                label: (
                  <span className={menuLabelClassName}>{labels.settings}</span>
                ),
                icon: (
                  <IconSettings
                    size={DIAL_ICON_SIZE.SM}
                    aria-hidden
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                ),
                onClick: onSettings,
              },
            ]
          : []),
        {
          key: 'logout',
          label: <span className={menuLabelClassName}>{labels.logOut}</span>,
          icon: (
            <IconLogout
              size={DIAL_ICON_SIZE.SM}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          ),
          onClick: onLogout,
        },
      ];
    }, [
      groups,
      labelClassName,
      menuLabelClassName,
      labels.logOut,
      labels.settings,
      onLogout,
      onSettings,
      profile.displayName,
      profile.shortName,
    ]);

    return (
      <div
        style={{ ...cssVars, ...menuCssVars }}
        className={mergeClasses(
          styles.wrapper,
          'flex size-[60px] items-center justify-center',
          className,
        )}
      >
        <Dropdown placement="top-end" matchReferenceWidth={false} items={items}>
          {/* The email tooltip describes the button itself (the kit attaches
              it with `asChild`), not a wrapper span around the avatar that no
              screen reader associated with the control. */}
          <Button
            aria-label={labels.trigger}
            tooltipProps={{
              tooltip: profile.email,
              hideTooltip: isTooltipHidden,
            }}
            iconBefore={<UserAvatar profile={profile} alt={labels.avatarAlt} />}
            className={mergeClasses(
              'size-[44px] gap-0 !rounded-full p-0',
              styles.trigger,
            )}
          />
        </Dropdown>
      </div>
    );
  },
);
