import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  EllipsisTooltip,
} from '@epam/ai-dial-ui-kit';
import { IconChevronRight, IconLogout } from '@tabler/icons-react';
import { memo, type FC } from 'react';
import { useSheetNavigation } from '../../hooks/useSheetNavigation';
import type { NavigationMenuGroup } from '../../models/navigation-menu';
import type { NavigationUserProfile } from '../../models/user-profile';
import { UserAvatar } from '../common/UserAvatar';
import styles from './NavigationSheet.module.scss';
import { OptionListPage } from './OptionListPage';
import { SheetRow } from './SheetRow';

/** Props for `ProfilePage`. */
export interface ProfilePageProps {
  /** Signed-in user details shown in the identity row. */
  profile: NavigationUserProfile;
  /** Label of the log-out row. */
  logOutLabel: string;
  /** Called when the user taps "Log out"; the sheet closes first. */
  onLogout: () => void;
  /** Settings groups listed above the log-out row; empty groups are skipped. */
  groups?: NavigationMenuGroup[];
  /** CSS class controlling the row labels' type scale. Defaults to `'dial-small-text'`. */
  textClassName?: string;
}

/**
 * Sheet page showing the signed-in user, their settings groups (each pushing an
 * `OptionListPage`), and a log-out row.
 */
export const ProfilePage: FC<ProfilePageProps> = memo(
  ({
    profile,
    logOutLabel,
    onLogout,
    groups,
    textClassName = 'dial-small-text',
  }) => {
    const { push, close } = useSheetNavigation();

    const settingsGroups = (groups ?? []).filter(
      ({ options }) => options.length > 0,
    );

    const handleLogout = () => {
      close();
      onLogout();
    };

    return (
      <>
        <div className="flex h-[56px] items-center gap-3 px-4 py-2">
          <UserAvatar profile={profile} alt="" />
          <EllipsisTooltip
            text={profile.displayName}
            className={mergeClasses(
              styles.mutedText,
              textClassName,
              'min-w-0 flex-1 truncate',
            )}
          />
        </div>

        {settingsGroups.length > 0 && (
          <>
            <ul className="flex flex-col">
              {settingsGroups.map((group) => (
                <SheetRow
                  key={group.id}
                  label={group.label}
                  icon={group.icon}
                  textClassName={textClassName}
                  trailing={
                    <IconChevronRight
                      size={BASE_ICON_SIZE}
                      stroke={DIAL_KIT_ICON_STROKE}
                      aria-hidden
                      className={mergeClasses(
                        styles.rowIcon,
                        'rtl:scale-x-[-1]',
                      )}
                    />
                  }
                  onClick={() =>
                    push({
                      title: group.label,
                      content: (
                        <OptionListPage
                          options={group.options}
                          textClassName={textClassName}
                        />
                      ),
                    })
                  }
                />
              ))}
            </ul>

            <hr className={styles.divider} />
          </>
        )}

        <ul className="flex flex-col pb-4">
          <SheetRow
            label={logOutLabel}
            textClassName={textClassName}
            icon={
              <IconLogout
                size={BASE_ICON_SIZE}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden
              />
            }
            onClick={handleLogout}
          />
        </ul>
      </>
    );
  },
);
