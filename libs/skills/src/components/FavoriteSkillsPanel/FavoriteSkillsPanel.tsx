import {
  buildCssVars,
  DeploymentIcon,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  Button,
  ButtonAppearance,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostButton,
  InteractiveTooltip,
  Spinner,
  ToggleIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconEye, IconStarFilled } from '@tabler/icons-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
} from 'react';
import type { FavoriteSkillItem } from '../../models/favorite-skill-item';
import type { FavoriteSkillsPanelProps } from '../../models/favorite-skills-panel-props';
import styles from './FavoriteSkillsPanel.module.scss';

const SECTION_HEADING_CLASS_NAME = 'px-3 pb-0.5 pt-2';

/* Must match the .rowLeaving exit-animation duration in FavoriteSkillsPanel.module.scss. */
const ROW_LEAVE_ANIMATION_MS = 180;

/* Matches the max-h-72 cap on the scrollable list. */
const LIST_MAX_HEIGHT_PX = 288;

/*
 * Grace period before an unhovered tooltip panel closes, giving the pointer
 * time to cross from the row onto the panel (and back) without the panel
 * vanishing under it. Any hover or focus re-entry cancels the pending close.
 */
const TOOLTIP_CLOSE_DELAY_MS = 300;

/*
 * Fires the open notification when the tooltip panel's content mounts. The
 * kit's `InteractiveTooltip` renders its content only while open, so mounting
 * is the open event — and the only reliable one: passing `onOpenChange`
 * without `open` replaces the kit's internal open-state setter with the
 * callback, leaving the panel forever closed. Must render `null` and stay
 * first in the content so it never affects the panel's layout.
 */
const TooltipOpenSignal: FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    onOpenRef.current();
  }, []);

  return null;
};

/** Second-level "My Collection" panel: the user's favorite skills, or an empty-state hint, plus a "Browse" action. */
export const FavoriteSkillsPanel: FC<FavoriteSkillsPanelProps> = ({
  favorites,
  onSelect,
  onToggleFavorite,
  onBrowse,
  onViewDetails,
  onItemTooltipOpen,
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

  /*
   * The row tooltip's open state is panel-controlled rather than left to the
   * kit's internal hover logic: the kit closes the instant the pointer leaves
   * the row-or-panel pair, which eats the panel when the pointer crosses the
   * gap. Here, leaving either side only *schedules* a close after
   * `TOOLTIP_CLOSE_DELAY_MS`, and entering either side cancels it. Drop this
   * workaround (here and in `FavoritePromptsPanel`) when the ui-kit ships
   * dropdown rows with native interactive tooltips.
   */
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);
  const tooltipCloseTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const cancelTooltipClose = () => {
    clearTimeout(tooltipCloseTimeoutRef.current);
    tooltipCloseTimeoutRef.current = undefined;
  };

  const handleTooltipOpen = (id: string) => {
    cancelTooltipClose();
    setOpenTooltipId(id);
  };

  const scheduleTooltipClose = () => {
    cancelTooltipClose();
    tooltipCloseTimeoutRef.current = setTimeout(() => {
      setOpenTooltipId(null);
      tooltipCloseTimeoutRef.current = undefined;
    }, TOOLTIP_CLOSE_DELAY_MS);
  };

  useEffect(() => {
    const timeouts = leaveTimeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
      clearTimeout(tooltipCloseTimeoutRef.current);
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

  const renderRow = (item: FavoriteSkillItem) => {
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
        onMouseEnter={() => handleTooltipOpen(item.id)}
        onMouseLeave={scheduleTooltipClose}
        onFocus={() => handleTooltipOpen(item.id)}
        onBlur={scheduleTooltipClose}
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
        {/*
         * The row stays the focus/click target (`asChild`); the tooltip only
         * opens on hover or keyboard focus and renders nothing on touch-only
         * devices, where tapping the row still selects the skill.
         */}
        <InteractiveTooltip
          asChild
          open={openTooltipId === item.id}
          contentClassName="max-w-[550px]"
          content={
            <div
              className="flex flex-col gap-3"
              /* Hover or focus reaching the panel cancels the close the row's leave scheduled, and vice versa. */
              onMouseEnter={cancelTooltipClose}
              onMouseLeave={scheduleTooltipClose}
              onFocus={cancelTooltipClose}
              onBlur={scheduleTooltipClose}
            >
              <TooltipOpenSignal onOpen={() => onItemTooltipOpen?.(item.id)} />
              {item.isDescriptionLoading && (
                <Spinner size={DIAL_ICON_SIZE.SM} />
              )}
              {!item.isDescriptionLoading && hasDescription && (
                <p className="text-start">{item.description}</p>
              )}
              {/* The action is reachable regardless of the description's state — loading, resolved, or absent. */}
              <Button
                variant={ButtonVariant.Primary}
                appearance={ButtonAppearance.Link}
                label={viewDetailsLabel}
                iconBefore={
                  <IconEye
                    size={DIAL_ICON_SIZE.SM}
                    stroke={DIAL_KIT_ICON_STROKE}
                    aria-hidden
                  />
                }
                onClick={() => onViewDetails(item)}
              />
            </div>
          }
        >
          {row}
        </InteractiveTooltip>
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
