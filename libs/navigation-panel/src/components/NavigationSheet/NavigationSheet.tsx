import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { memo, useMemo, type FC } from 'react';
import type { NavigationSheetProps } from '../../models/navigation-sheet-props';
import { NavigableBottomSheet } from './NavigableBottomSheet';
import { NavigationMenuPage } from './NavigationMenuPage';
import styles from './NavigationSheet.module.scss';

/**
 * Mobile primary navigation: a bottom sheet whose root page lists the
 * destinations and a profile entry, with settings drilled into nested pages.
 */
export const NavigationSheet: FC<NavigationSheetProps> = memo(
  ({
    isOpen,
    onClose,
    items,
    onSelectItem,
    labels,
    profile,
    groups,
    onLogout,
    footer,
    styles: sheetStyles,
  }) => {
    const { colors, typography, className, cssVars } = sheetStyles ?? {};

    const sheetCssVars = useMemo(
      () =>
        buildCssVars({
          '--np-sheet-text': colors?.text,
          '--np-sheet-item-hover': colors?.itemHoverBackground,
          '--np-sheet-item-active': colors?.itemActiveBackground,
          '--np-sheet-icon': colors?.icon,
          '--np-sheet-divider': colors?.divider,
          '--np-avatar-bg': colors?.avatarBackground,
          '--np-avatar-text': colors?.avatarText,
          '--np-menu-active-icon': colors?.activeIcon,
          '--np-font-family': typography?.fontFamily,
        }),
      [colors, typography?.fontFamily],
    );

    return (
      <NavigableBottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={labels.title}
        closeLabel={labels.close}
        backLabel={labels.back}
        className={mergeClasses(styles.sheet, className)}
        style={{ ...cssVars, ...sheetCssVars }}
      >
        <NavigationMenuPage
          items={items}
          onSelectItem={onSelectItem}
          profileLabel={labels.profile}
          logOutLabel={labels.logOut}
          onLogout={onLogout}
          profile={profile}
          groups={groups}
          footer={footer}
          textClassName={typography?.fontClassName}
        />
      </NavigableBottomSheet>
    );
  },
);
