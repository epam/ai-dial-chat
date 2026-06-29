import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DialButtonDropdown,
  DialGhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconLayoutCards, IconLayoutList } from '@tabler/icons-react';
import { FC } from 'react';
import { DEFAULT_SORT_OPTIONS } from '../../../constants/catalog-defaults';
import { ToolbarProps } from '../../../models/toolbar-props';
import { CatalogViewMode } from '../../../types/view-mode';
import { ItemHeader } from '../../ItemHeader/ItemHeader';
import styles from '../Toolbar.module.scss';

interface TitleRowProps {
  totalCount?: number;
  viewMode: CatalogViewMode;
  onViewModeChange: (mode: CatalogViewMode) => void;
  sortKey: string;
  onSortChange: (key: string) => void;
  title?: string;
  sortOptions?: { value: string; label: string }[];
  styles?: ToolbarProps['styles'];
}

/** Browse section header: title + count, segmented view toggle, sort dropdown. */
export const TitleRow: FC<TitleRowProps> = ({
  totalCount,
  viewMode,
  onViewModeChange,
  sortKey,
  onSortChange,
  title = 'Browse',
  sortOptions = DEFAULT_SORT_OPTIONS,
  styles: browseStyles,
}) => {
  const titleClassName =
    browseStyles?.typography?.titleClassName ?? 'dial-h3-text';
  const countClassName =
    browseStyles?.typography?.countClassName ?? 'dial-tiny-text';

  const currentSortLabel =
    sortOptions.find((o) => o.value === sortKey)?.label ?? '';

  return (
    <div className="mb-4 flex items-center">
      <ItemHeader
        title={title}
        postfix={totalCount}
        titleClassName={titleClassName}
        postfixClassName={countClassName}
        className="flex-1"
      />

      <div className="flex items-center gap-2">
        {/* Segmented view toggle: bg-layer-3 track, active button stands out */}
        <div className="flex items-center rounded-[8px] bg-layer-3 p-0.5">
          {([CatalogViewMode.Grid, CatalogViewMode.List] as const).map((mode) => {
            const isActive = viewMode === mode;
            return (
              <DialGhostIconButton
                key={mode}
                size={ElementSize.Small}
                icon={
                  mode === CatalogViewMode.Grid ? (
                    <IconLayoutCards size={DIAL_ICON_SIZE.SM} />
                  ) : (
                    <IconLayoutList size={DIAL_ICON_SIZE.SM} />
                  )
                }
                onClick={() => onViewModeChange(mode)}
                className={mergeClasses(
                  'rounded-[6px]',
                  isActive
                    ? '!bg-layer-0 !text-accent-primary shadow-sm'
                    : '!text-secondary',
                )}
              />
            );
          })}
        </div>

        <div className={mergeClasses('mx-0.5 h-5 w-px', styles.divider)} />

        <div className="max-w-[175px] flex-shrink-0">
          <DialButtonDropdown
            label={currentSortLabel}
            variant={ButtonVariant.Primary}
            appearance={ButtonAppearance.Ghost}
            items={sortOptions.map((o) => ({
              key: o.value,
              label: o.label,
              onClick: ({ key }: { key: string }) => onSortChange(key),
            }))}
          />
        </div>
      </div>
    </div>
  );
};
