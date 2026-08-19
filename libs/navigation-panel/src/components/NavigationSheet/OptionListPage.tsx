import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconCheck } from '@tabler/icons-react';
import { memo, type FC } from 'react';
import { useSheetNavigation } from '../../hooks/useSheetNavigation';
import type { NavigationMenuOption } from '../../models/navigation-menu';
import styles from './NavigationSheet.module.scss';
import { SheetRow } from './SheetRow';

/** Props for `OptionListPage`. */
export interface OptionListPageProps {
  /** Single-select options; picking one applies it and pops back one page. */
  options: NavigationMenuOption[];
  /** CSS class controlling the row labels' type scale. */
  textClassName?: string;
}

/** Sheet page listing the values of one settings group, with the applied one checked. */
export const OptionListPage: FC<OptionListPageProps> = memo(
  ({ options, textClassName }) => {
    const { pop } = useSheetNavigation();

    return (
      <ul className="flex flex-col pb-4">
        {options.map((option) => (
          <SheetRow
            key={option.id}
            label={option.label}
            icon={option.icon}
            textClassName={textClassName}
            trailing={
              option.isActive ? (
                <IconCheck
                  size={DIAL_ICON_SIZE.SM}
                  stroke={2}
                  aria-hidden
                  className={styles.activeIcon}
                />
              ) : undefined
            }
            onClick={() => {
              option.onSelect();
              pop();
            }}
          />
        ))}
      </ul>
    );
  },
);
