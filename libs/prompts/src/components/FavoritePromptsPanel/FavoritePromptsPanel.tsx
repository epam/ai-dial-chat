import {
  buildCssVars,
  DeploymentIcon,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  GhostButton,
  ToggleIconButton,
  Tooltip,
} from '@epam/ai-dial-ui-kit';
import { IconStarFilled } from '@tabler/icons-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
} from 'react';
import type { FavoritePromptItem } from '../../models/favorite-prompt-item';
import type { FavoritePromptsPanelProps } from '../../models/favorite-prompts-panel-props';
import styles from './FavoritePromptsPanel.module.scss';

const SECTION_HEADING_CLASS_NAME = 'px-3 pb-0.5 pt-2';

/* Must match the .rowLeaving exit-animation duration in FavoritePromptsPanel.module.scss. */
const ROW_LEAVE_ANIMATION_MS = 180;

/* Matches the max-h-72 cap on the scrollable list. */
const LIST_MAX_HEIGHT_PX = 288;

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
    '--fp-row-hover-bg': colors?.rowHoverBackground,
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
        Math.min(listContentRef.current.scrollHeight, LIST_MAX_HEIGHT_PX),
      );
    }
  }, [favorites]);

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
          onClick={(e) => {
            e.stopPropagation();
            handleToggleFavorite(item.id);
          }}
        />
      </div>
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
          <Tooltip tooltip={item.description} triggerClassName="block">
            {row}
          </Tooltip>
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
          'max-h-72 min-h-0 flex-1 overflow-y-auto',
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
