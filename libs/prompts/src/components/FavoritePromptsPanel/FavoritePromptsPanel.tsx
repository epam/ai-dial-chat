import {
  buildCssVars,
  DeploymentIcon,
  mergeClasses,
  SELECT_LIST_MAX_HEIGHT_CLASS_NAME,
  SELECT_LIST_MAX_HEIGHT_PX,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  GhostButton,
  InteractiveTooltip,
  MenuItem,
  ToggleIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconStarFilled } from '@tabler/icons-react';
import { useEffect, useLayoutEffect, useRef, useState, type FC } from 'react';
import type { FavoritePromptItem } from '../../models/favorite-prompt-item';
import type { FavoritePromptsPanelProps } from '../../models/favorite-prompts-panel-props';
import styles from './FavoritePromptsPanel.module.scss';

const SECTION_HEADING_CLASS_NAME = 'px-3 pb-0.5 pt-2';

/* Must match the .rowLeaving exit-animation duration in FavoritePromptsPanel.module.scss. */
const ROW_LEAVE_ANIMATION_MS = 180;

/**
 * Second-level "My Collection" panel: the user's favorite prompts, or an
 * empty-state hint, plus a "Browse" action.
 */
export const FavoritePromptsPanel: FC<FavoritePromptsPanelProps> = ({
  favorites,
  onSelect,
  onToggleFavorite,
  onBrowse,
  labels = {},
  colors,
  nameClassName = 'dial-small-text',
  headerClassName = 'dial-tiny-lead-semi-text',
  emptyHintClassName = 'dial-small-text',
}) => {
  const {
    myCollectionLabel = 'My Collection',
    emptyHintLabel = 'Star a prompt to pin it here',
    browseLabel = 'Browse',
    removeFromFavoritesLabel = 'Remove from favorites',
  } = labels;

  const cssVars = buildCssVars({
    '--fp-header-text': colors?.headerText,
    '--fp-empty-hint-text': colors?.emptyHintText,
    '--fp-star-color': colors?.starColor,
    '--fp-footer-border': colors?.footerBorder,
  });

  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const leaveTimeoutsRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );

  useEffect(() => {
    const timeouts = leaveTimeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  /*
   * Animates the scrollable list's own height as rows leave instead of
   * letting it snap instantly, since CSS can't transition height: auto.
   */
  const listContentRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState<number>();

  useLayoutEffect(() => {
    if (listContentRef.current) {
      setListHeight(
        Math.min(
          listContentRef.current.scrollHeight,
          SELECT_LIST_MAX_HEIGHT_PX,
        ),
      );
    }
  }, [favorites]);

  /*
   * Plays the row's fade-out animation before actually committing the
   * favorite change, since applying it immediately would make the row
   * (and its own animation) disappear instantly.
   */
  const handleToggleFavorite = (id: string) => {
    setLeavingIds((prev) => new Set(prev).add(id));
    const timeout = setTimeout(() => {
      onToggleFavorite(id);
      setLeavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      leaveTimeoutsRef.current.delete(id);
    }, ROW_LEAVE_ANIMATION_MS);
    leaveTimeoutsRef.current.set(id, timeout);
  };

  const renderRow = (item: FavoritePromptItem) => {
    const row = (
      /*
        The kit's own select-list row, so its rest, hover and focus states come
        from the design's list-item spec. The star goes through `rightControl`:
        it is a button, and a button nested inside the row's own button would be
        invalid markup, swallow the row's click, and land inside the row's
        accessible name.
      */
      <MenuItem
        className="h-auto py-1.5"
        icon={
          <DeploymentIcon size={DIAL_ICON_SIZE.MD} initialsName={item.name} />
        }
        label={item.name}
        labelClassName={nameClassName}
        onClick={() => onSelect(item)}
        /* `MenuItem` is a real button, so it needs no custom keydown handling for Enter/Space. */
        rightControl={
          <ToggleIconButton
            icon={
              <IconStarFilled
                size={DIAL_ICON_SIZE.SM}
                className={styles.star}
                aria-hidden
              />
            }
            aria-label={removeFromFavoritesLabel}
            /* Every row in this panel is a favorite, so the star is always on. */
            isSelected
            onClick={() => handleToggleFavorite(item.id)}
          />
        }
      />
    );

    const hasDescription = item.description != null && item.description !== '';

    return (
      <li
        key={item.id}
        className={
          leavingIds.has(item.id) ? styles.rowLeaving : styles.rowEnter
        }
      >
        {hasDescription ? (
          /*
           * The row stays the focus/click target (`asChild`); the tooltip is
           * uncontrolled — the kit opens it on hover or keyboard focus and
           * keeps it open while the pointer travels between the row and the
           * panel — and renders nothing on touch-only devices, where tapping
           * the row still inserts the prompt. Rows without a description are
           * not wrapped at all.
           */
          <InteractiveTooltip
            asChild
            contentClassName="max-w-[550px]"
            content={<p className="text-start">{item.description}</p>}
          >
            {row}
          </InteractiveTooltip>
        ) : (
          row
        )}
      </li>
    );
  };

  return (
    <div className="flex min-w-[240px] flex-col" style={cssVars}>
      <p
        className={mergeClasses(
          headerClassName,
          SECTION_HEADING_CLASS_NAME,
          styles.header,
        )}
      >
        {myCollectionLabel}
      </p>

      <div
        className={mergeClasses(
          SELECT_LIST_MAX_HEIGHT_CLASS_NAME,
          'min-h-0 flex-1 overflow-y-auto',
          styles.listContent,
        )}
        style={{ maxHeight: listHeight }}
      >
        <div ref={listContentRef}>
          {favorites.length > 0 ? (
            <ul className="flex flex-col gap-1 px-1 pb-1">
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
        </div>
      </div>

      <div className={mergeClasses('border-t px-2 py-3', styles.footer)}>
        <GhostButton
          label={browseLabel}
          className="w-full justify-center"
          onClick={onBrowse}
        />
      </div>
    </div>
  );
};
