import {
  buildCssVars,
  DeploymentIcon,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  GhostButton,
  Highlight,
  InteractiveTooltip,
  ToggleIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconStarFilled } from '@tabler/icons-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
} from 'react';
import { SKILLS_CLASS } from '../../constants/public-class-names';
import type { FavoriteSkillItem } from '../../models/favorite-skill-item';
import type { FavoriteSkillsPanelProps } from '../../models/favorite-skills-panel-props';
import { SkillInfoTooltipContent } from '../SkillInfoTooltipContent/SkillInfoTooltipContent';
import styles from './FavoriteSkillsPanel.module.scss';

const SECTION_HEADING_CLASS_NAME = 'px-3 pb-0.5 pt-2';

/* Must match the .rowLeaving exit-animation duration in FavoriteSkillsPanel.module.scss. */
const ROW_LEAVE_ANIMATION_MS = 180;

/* Matches the max-h-72 cap on the scrollable list. */
const LIST_MAX_HEIGHT_PX = 288;

/** Second-level "My Collection" panel: the user's favorite skills, or an empty-state hint, plus a "Browse" action. */
export const FavoriteSkillsPanel: FC<FavoriteSkillsPanelProps> = ({
  favorites,
  onSelect,
  onToggleFavorite,
  onBrowse,
  onViewDetails,
  className,
  rowClassName,
  searchQuery,
  listboxId,
  activeOptionId,
  isMenu = false,
  labels = {},
  colors,
  nameClassName = 'dial-small-text',
  headerClassName = 'dial-tiny-lead-semi-text',
  emptyHintClassName = 'dial-small-text',
}) => {
  const {
    myCollectionLabel = 'My Collection',
    emptyHintLabel = 'Star a skill to pin it here',
    browseLabel = 'Browse',
    removeFromFavoritesLabel = 'Remove from favorites',
    viewDetailsLabel = 'View details',
    noMatchingSkillsLabel = 'No matching skills',
  } = labels;

  const cssVars = buildCssVars({
    '--fs-row-hover-bg': colors?.rowHoverBackground,
    '--fs-header-text': colors?.headerText,
    '--fs-empty-hint-text': colors?.emptyHintText,
    '--fs-star-color': colors?.starColor,
    '--fs-footer-border': colors?.footerBorder,
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

  const isListbox = listboxId != null;
  const isMenuMode = isMenu && !isListbox;
  /* The list wrappers step aside (`role="none"`) wherever the rows belong to a listbox or a host menu. */
  const listItemRole = isListbox || isMenuMode ? 'none' : undefined;
  let rowRole = 'button';
  if (isListbox) {
    rowRole = 'option';
  } else if (isMenuMode) {
    rowRole = 'menuitem';
  }
  /* Names the listbox: the "My Collection" header is what the rows sit under. */
  const headerId = useId();

  const isSearchMode = searchQuery != null;
  const normalizedQuery = searchQuery?.toLowerCase() ?? '';
  const visibleFavorites = isSearchMode
    ? favorites.filter((item) =>
        item.name.toLowerCase().includes(normalizedQuery),
      )
    : favorites;

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
  }, [favorites, searchQuery]);

  const handleKeyDown = (
    e: KeyboardEvent<HTMLDivElement>,
    item: FavoriteSkillItem,
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
      onToggleFavorite?.(id);
      setLeavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      leaveTimeoutsRef.current.delete(id);
    }, ROW_LEAVE_ANIMATION_MS);
    leaveTimeoutsRef.current.set(id, timeout);
  };

  const renderRow = (item: FavoriteSkillItem) => {
    /*
     * Listbox mode: the row is an option the owning text field points at via
     * `aria-activedescendant`, so its id is derived from the listbox id (item
     * ids are resource URLs, hence the encoding). The row itself stays
     * tabbable so Tab walks from row to row, while its secondary controls
     * (star, "View details") drop out of the Tab sequence — otherwise every
     * step between two rows passes a destructive "Remove from favorites".
     */
    const optionId = isListbox
      ? `${listboxId}-${encodeURIComponent(item.id)}`
      : undefined;
    const secondaryTabIndex = isListbox ? -1 : undefined;
    const row = (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- the computed role is always interactive ('option', 'menuitem' or 'button').
      <div
        role={rowRole}
        id={optionId}
        aria-selected={isListbox ? optionId === activeOptionId : undefined}
        aria-label={item.name}
        tabIndex={0}
        className={mergeClasses(
          'flex cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-colors',
          styles.row,
          rowClassName,
        )}
        onClick={() => onSelect(item)}
        onKeyDown={(e) => handleKeyDown(e, item)}
      >
        <DeploymentIcon size={DIAL_ICON_SIZE.MD} initialsName={item.name} />
        {searchQuery != null ? (
          <Highlight
            text={item.name}
            query={searchQuery}
            maxLines={1}
            className={mergeClasses(nameClassName, 'min-w-0 flex-1 text-start')}
          />
        ) : (
          <span
            className={mergeClasses(
              nameClassName,
              'min-w-0 flex-1 truncate text-start',
            )}
          >
            {item.name}
          </span>
        )}
        {onToggleFavorite && (
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
            tabIndex={secondaryTabIndex}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFavorite(item.id);
            }}
          />
        )}
      </div>
    );

    return (
      <li
        key={item.id}
        role={listItemRole}
        className={
          leavingIds.has(item.id) ? styles.rowLeaving : styles.rowEnter
        }
      >
        {/*
         * The row stays the focus/click target (`asChild`); the tooltip is
         * uncontrolled — the kit opens it on hover or keyboard focus and keeps
         * it open while the pointer travels between the row and the panel —
         * and renders nothing on touch-only devices, where tapping the row
         * still selects the skill.
         */}
        {onViewDetails ? (
          <InteractiveTooltip
            asChild
            contentClassName="max-w-[550px]"
            content={
              <SkillInfoTooltipContent
                description={item.description}
                viewDetailsLabel={viewDetailsLabel}
                onViewDetails={() => onViewDetails(item)}
                viewDetailsTabIndex={secondaryTabIndex}
              />
            }
          >
            {row}
          </InteractiveTooltip>
        ) : (
          row
        )}
      </li>
    );
  };

  /*
   * In search mode an empty list is the filter's result, not the empty
   * favorites state, so it gets its own hint — announced via aria-live since
   * the user is typing and the change has no other confirmation. An empty
   * query still shows every row, so it never reaches the no-matching branch.
   */
  const renderListBody = () => {
    if (visibleFavorites.length > 0) {
      return (
        <ul
          id={listboxId}
          role={isListbox ? 'listbox' : listItemRole}
          aria-labelledby={isListbox ? headerId : undefined}
          className="flex flex-col gap-1 px-1 pb-1"
        >
          {visibleFavorites.map(renderRow)}
        </ul>
      );
    }

    if (isSearchMode && normalizedQuery !== '') {
      return (
        <p
          role="status"
          aria-live="polite"
          className={mergeClasses(
            emptyHintClassName,
            'px-4 py-4 text-start',
            styles.emptyHint,
          )}
        >
          {noMatchingSkillsLabel}
        </p>
      );
    }

    return (
      <p
        className={mergeClasses(
          emptyHintClassName,
          'px-4 py-4 text-start',
          styles.emptyHint,
        )}
      >
        {emptyHintLabel}
      </p>
    );
  };

  return (
    <div
      className={mergeClasses(
        'flex w-full flex-col desktop:w-[280px]',
        className,
        SKILLS_CLASS.favoritesPanel,
      )}
      style={cssVars}
    >
      <p
        id={headerId}
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
        <div ref={listContentRef}>{renderListBody()}</div>
      </div>

      <div className={mergeClasses('border-t px-2 py-3', styles.footer)}>
        <GhostButton
          role={isMenuMode ? 'menuitem' : undefined}
          label={browseLabel}
          className="w-full justify-center"
          onClick={onBrowse}
        />
      </div>
    </div>
  );
};
