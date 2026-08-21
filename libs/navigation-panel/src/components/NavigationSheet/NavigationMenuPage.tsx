import { BASE_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconUser } from '@tabler/icons-react';
import { memo, type FC, type ReactNode } from 'react';
import { useSheetNavigation } from '../../hooks/useSheetNavigation';
import type { NavigationPanelItem } from '../../models/navigation-item';
import type { NavigationMenuGroup } from '../../models/navigation-menu';
import type { NavigationUserProfile } from '../../models/user-profile';
import { ProfilePage } from './ProfilePage';
import { SheetRow } from './SheetRow';

/** Props for `NavigationMenuPage`. */
export interface NavigationMenuPageProps {
  /** Destinations rendered as rows, in display order. */
  items: NavigationPanelItem[];
  /** Called with the picked destination after the sheet closes. */
  onSelectItem: (item: NavigationPanelItem) => void;
  /** Label of the row opening the profile page, also that page's title. */
  profileLabel: string;
  /** Label of the log-out row on the profile page. */
  logOutLabel: string;
  /** Called when the user taps "Log out" on the profile page. */
  onLogout: () => void;
  /** Signed-in user details; omit to hide the profile row entirely. */
  profile?: NavigationUserProfile;
  /** Settings groups listed on the profile page; empty groups are skipped. */
  groups?: NavigationMenuGroup[];
  /** Rendered below the row list — typically a footer message. */
  footer?: ReactNode;
  /** CSS class controlling the row labels' type scale. Defaults to `'dial-small-text'`. */
  textClassName?: string;
}

/** Root page of the navigation bottom sheet: destinations plus a profile entry. */
export const NavigationMenuPage: FC<NavigationMenuPageProps> = memo(
  ({
    items,
    onSelectItem,
    profileLabel,
    logOutLabel,
    onLogout,
    profile,
    groups,
    footer,
    textClassName,
  }) => {
    const { push, close } = useSheetNavigation();

    const handleSelectItem = (item: NavigationPanelItem) => {
      close();
      onSelectItem(item);
    };

    const handleOpenProfile = () => {
      if (!profile) return;
      push({
        title: profileLabel,
        content: (
          <ProfilePage
            profile={profile}
            groups={groups}
            logOutLabel={logOutLabel}
            onLogout={onLogout}
            textClassName={textClassName}
          />
        ),
      });
    };

    return (
      <>
        <ul className="flex flex-col pb-4">
          {items.map((item) => (
            <SheetRow
              key={item.id}
              label={item.label}
              textClassName={textClassName}
              icon={<item.icon size={BASE_ICON_SIZE} stroke={1.5} />}
              onClick={() => handleSelectItem(item)}
            />
          ))}
          {profile && (
            <SheetRow
              label={profileLabel}
              textClassName={textClassName}
              icon={<IconUser size={BASE_ICON_SIZE} stroke={1.5} aria-hidden />}
              onClick={handleOpenProfile}
            />
          )}
        </ul>
        {footer}
      </>
    );
  },
);
