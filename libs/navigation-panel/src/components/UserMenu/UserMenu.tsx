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
import {
  IconChevronDown,
  IconChevronUp,
  IconLogout,
  IconSettings,
} from '@tabler/icons-react';
import { memo, useMemo, useState, type FC } from 'react';
import type { UserMenuProps } from '../../models/user-menu-props';
import { UserMenuTriggerVariant } from '../../types/user-menu-trigger-variant';
import { AvatarInitials } from '../common/AvatarInitials';
import { UserAvatar } from '../common/UserAvatar';
import styles from './UserMenu.module.scss';

/**
 * User trigger that opens a dropdown with the user's identity, single-select
 * settings submenus, an optional Settings entry and a log-out entry.
 */
export const UserMenu: FC<UserMenuProps> = memo(
  ({
    profile,
    labels,
    groups,
    onLogout,
    onSettings,
    triggerVariant = UserMenuTriggerVariant.Avatar,
    isTooltipHidden,
    isIdentityHidden = false,
    styles: menuStyles,
  }) => {
    const { colors, typography, className, cssVars } = menuStyles ?? {};
    const [isOpen, setIsOpen] = useState(false);
    const isProfileTrigger = triggerVariant === UserMenuTriggerVariant.Profile;
    const isCompactTrigger = triggerVariant === UserMenuTriggerVariant.Compact;
    const isStartPlacement = isProfileTrigger || isCompactTrigger;
    const labelClassName = typography?.fontClassName ?? 'dial-small-text';

    const menuCssVars = useMemo(
      () =>
        buildCssVars({
          '--np-avatar-bg': colors?.avatarBackground,
          '--np-avatar-text': colors?.avatarText,
          '--np-menu-text': colors?.text,
          '--np-trigger-hover-bg': colors?.triggerHoverBackground,
          '--np-trigger-open-bg': colors?.triggerOpenBackground,
          '--np-focus-outline': colors?.focusOutline,
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

      const identityItems: DropdownItem[] = isIdentityHidden
        ? []
        : [
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
          ];
      const headItems = [...identityItems, ...groupItems];

      return [
        ...headItems,
        /* Nothing above the divider means nothing to separate: the menu must
           not open on one. */
        ...(headItems.length > 0
          ? [{ key: 'divider-1', type: DropdownItemType.Divider }]
          : []),
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
      isIdentityHidden,
      labelClassName,
      menuLabelClassName,
      labels.logOut,
      labels.settings,
      onLogout,
      onSettings,
      profile.displayName,
      profile.shortName,
    ]);

    const renderTrigger = () => {
      /* `Avatar` sits in the rail's 60px square; `Compact` is a 40px pill
         that, like `Profile`, shows the open state. */
      if (!isProfileTrigger) {
        return (
          <Button
            aria-label={labels.trigger}
            tooltipProps={{
              tooltip: profile.email,
              hideTooltip: isTooltipHidden,
            }}
            iconBefore={
              <UserAvatar
                profile={profile}
                alt={labels.avatarAlt}
                size={isCompactTrigger ? 24 : undefined}
                initialsClassName={typography?.avatarInitialsClassName}
              />
            }
            className={mergeClasses(
              isCompactTrigger
                ? 'size-10! min-h-0! min-w-0! gap-0 rounded-full! border-0! p-2!'
                : 'size-[44px] gap-0 rounded-full! p-0',
              styles.trigger,
              isCompactTrigger && isOpen && styles.triggerOpen,
            )}
          />
        );
      }

      const Chevron = isOpen ? IconChevronUp : IconChevronDown;

      /* No `aria-label`: the accessible name starts with the visible name, so a
         voice-control user can say what they see (WCAG 2.5.3). The trigger
         label follows it as hidden text, and the avatar stays unnamed. */
      return (
        <Button
          tooltipProps={{
            tooltip: profile.email,
            hideTooltip: isTooltipHidden,
          }}
          iconBefore={
            <UserAvatar
              profile={profile}
              alt=""
              size={24}
              initialsClassName={typography?.avatarInitialsClassName}
            />
          }
          label={
            <>
              <EllipsisTooltip
                text={profile.displayName}
                className={mergeClasses(
                  styles.identityText,
                  labelClassName,
                  'min-w-0 truncate',
                )}
              />
              <span className="sr-only">{labels.trigger}</span>
            </>
          }
          iconAfter={
            <Chevron
              size={DIAL_ICON_SIZE.SM}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
            />
          }
          textClassName="min-w-0"
          className={mergeClasses(
            'h-10! min-h-0! max-w-full min-w-0! gap-2 rounded-full! border-0! p-2!',
            styles.trigger,
            isOpen && styles.triggerOpen,
          )}
        />
      );
    };

    return (
      <div
        style={{ ...cssVars, ...menuCssVars }}
        className={mergeClasses(
          styles.wrapper,
          isStartPlacement
            ? 'flex min-w-0 items-center'
            : 'flex size-[60px] items-center justify-center',
          /* The profile trigger takes the room its neighbours leave, so a long
             name is truncated instead of running under them. */
          isProfileTrigger && 'flex-1',
          className,
        )}
      >
        <Dropdown
          /* The trigger wrapper is a flex item: without `min-w-0` it cannot
             shrink below its text, and a long name runs past the wrapper
             instead of being truncated. */
          className={isStartPlacement ? 'max-w-full min-w-0' : undefined}
          placement={isStartPlacement ? 'top-start' : 'top-end'}
          matchReferenceWidth={false}
          items={items}
          onOpenChange={setIsOpen}
        >
          {/* The email tooltip describes the button itself (the kit attaches
              it with `asChild`), not a wrapper span around the avatar that no
              screen reader associated with the control. */}
          {renderTrigger()}
        </Dropdown>
      </div>
    );
  },
);
