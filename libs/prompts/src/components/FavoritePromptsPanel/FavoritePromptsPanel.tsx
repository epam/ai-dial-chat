import {
  buildCssVars,
  DeploymentIcon,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialTooltip,
  GhostButton,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronLeft, IconStarFilled } from '@tabler/icons-react';
import type { FC, KeyboardEvent } from 'react';
import type { FavoritePromptItem } from '../../models/favorite-prompt-item';
import type { FavoritePromptsPanelProps } from '../../models/favorite-prompts-panel-props';
import styles from './FavoritePromptsPanel.module.scss';

/**
 * Second-level "My Collection" panel: the user's favorite prompts, or an
 * empty-state hint, plus a "Browse" action.
 */
export const FavoritePromptsPanel: FC<FavoritePromptsPanelProps> = ({
  favorites,
  onSelect,
  onToggleFavorite,
  onBrowse,
  onBack,
  labels = {},
  colors,
  nameClassName = 'dial-small-text',
  headerClassName = 'dial-tiny-semi-text',
  emptyHintClassName = 'dial-small-text',
}) => {
  const {
    myCollectionLabel = 'My Collection',
    emptyHintLabel = 'Star a prompt to pin it here',
    browseLabel = 'Browse',
    removeFromFavoritesLabel = 'Remove from favorites',
    backLabel = 'Back',
  } = labels;

  const cssVars = buildCssVars({
    '--fp-row-hover-bg': colors?.rowHoverBackground,
    '--fp-header-text': colors?.headerText,
    '--fp-empty-hint-text': colors?.emptyHintText,
    '--fp-star-color': colors?.starColor,
    '--fp-footer-border': colors?.footerBorder,
  });

  const handleKeyDown = (
    e: KeyboardEvent<HTMLDivElement>,
    item: FavoritePromptItem,
  ) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(item);
    }
  };

  const renderRow = (item: FavoritePromptItem) => {
    const row = (
      <div
        role="button"
        tabIndex={0}
        className={mergeClasses(
          'flex cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-colors',
          styles.row,
        )}
        onClick={() => onSelect(item)}
        onKeyDown={(e) => handleKeyDown(e, item)}
      >
        <DeploymentIcon size={DIAL_ICON_SIZE.MD} initialsName={item.name} />
        <span
          className={mergeClasses(
            nameClassName,
            'min-w-0 flex-1 truncate text-start',
          )}
        >
          {item.name}
        </span>
        <GhostIconButton
          icon={
            <IconStarFilled
              size={DIAL_ICON_SIZE.SM}
              className={styles.star}
              aria-hidden
            />
          }
          aria-label={removeFromFavoritesLabel}
          aria-pressed
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item.id);
          }}
        />
      </div>
    );

    const hasDescription = item.description != null && item.description !== '';

    return (
      <li key={item.id}>
        {hasDescription ? (
          <DialTooltip tooltip={item.description} triggerClassName="block">
            {row}
          </DialTooltip>
        ) : (
          row
        )}
      </li>
    );
  };

  return (
    <div className="flex min-w-[240px] flex-col" style={cssVars}>
      <div className="flex items-center gap-1 pb-0.5 pt-2">
        {onBack != null && (
          <GhostIconButton
            icon={<IconChevronLeft className="rtl:scale-x-[-1]" aria-hidden />}
            aria-label={backLabel}
            onClick={onBack}
            className="ms-1"
          />
        )}
        <p
          className={mergeClasses(
            headerClassName,
            'px-3 uppercase',
            onBack != null ? 'ps-0' : null,
            styles.header,
          )}
        >
          {myCollectionLabel}
        </p>
      </div>

      {favorites.length > 0 ? (
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto px-1 pb-1">
          {favorites.map(renderRow)}
        </ul>
      ) : (
        <p
          className={mergeClasses(
            emptyHintClassName,
            'px-4 py-4 text-start',
            styles.emptyHint,
          )}
        >
          {emptyHintLabel}
        </p>
      )}

      <div className={mergeClasses('border-t px-2 py-1', styles.footer)}>
        <GhostButton
          label={browseLabel}
          className="w-full justify-center"
          onClick={onBrowse}
        />
      </div>
    </div>
  );
};
