import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  EllipsisTooltip,
  Tooltip,
  Dropdown,
  DropdownItemType,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import { IconLogout } from '@tabler/icons-react';
import { memo, useMemo, type FC } from 'react';
import type { UserMenuProps } from '../../models/user-menu-props';
import { AvatarInitials } from '../common/AvatarInitials';
import { MenuItemLabel } from '../common/MenuItemLabel';
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
          '--np-menu-active-icon': colors?.activeIcon,
          '--np-trigger-hover-bg': colors?.triggerHoverBackground,
          '--np-font-family': typography?.fontFamily,
        }),
      [colors, typography?.fontFamily],
    );

    const items = useMemo<DropdownItem[]>(() => {
      const groupItems = (groups ?? [])
        .filter(({ options }) => options.length > 0)
        .map(({ id, label, icon, options }) => ({
          key: id,
          label: <span className={labelClassName}>{label}</span>,
          icon,
          children: options.map((option) => ({
            key: option.id,
            label: (
              <MenuItemLabel
                label={option.label}
                isActive={option.isActive}
                icon={option.icon}
                textClassName={labelClassName}
              />
            ),
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
        {
          key: 'logout',
          label: <span className={labelClassName}>{labels.logOut}</span>,
          icon: <IconLogout size={DIAL_ICON_SIZE.SM} aria-hidden />,
          onClick: onLogout,
        },
      ];
    }, [
      groups,
      labelClassName,
      labels.logOut,
      onLogout,
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
          <button
            type="button"
            className={mergeClasses(
              styles.trigger,
              'flex size-[44px] items-center justify-center rounded-full border border-transparent',
            )}
            aria-label={labels.trigger}
          >
            <Tooltip tooltip={profile.email} hideTooltip={isTooltipHidden}>
              <UserAvatar profile={profile} alt={labels.avatarAlt} />
            </Tooltip>
          </button>
        </Dropdown>
      </div>
    );
  },
);
