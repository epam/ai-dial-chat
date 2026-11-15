import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  GhostIconButton,
  Highlight,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import {
  IconBriefcase,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react';
import { memo, type FC, type MouseEvent } from 'react';
import { useRowActions } from '../../hooks/useRowActions';
import type { PinnedProjectGroup } from '../../models/pinned-projects';
import { ConversationRowVariant } from '../../types/conversation-row-variant';
import { getButtonPaddingEnd } from '../../utils/conversation-row';
import styles from '../ConversationPanel/ConversationPanel.module.scss';
import { RowActionsMenu } from '../RowActionsMenu/RowActionsMenu';
import { RowLink } from '../RowLink/RowLink';
import projectStyles from './ProjectRow.module.scss';

/** Props for `ProjectRow`. */
export interface ProjectRowProps {
  /** The pinned project to display. */
  project: PinnedProjectGroup;
  /** Whether this project is the one the host currently shows. */
  isActive: boolean;
  /** Whether the project's chats are shown. Defaults to `true`. */
  isExpanded?: boolean;
  /** `id` of the list container the chevron controls, referenced by its `aria-controls`. */
  listId?: string;
  /** Called with the project `id` when the row is activated. */
  onSelectProject: (projectId: string) => void;
  /** Called with the project `id` and the state the chevron asks for (`true` expands, `false` collapses) when it is activated. The chevron renders only when set. */
  onToggleProject?: (projectId: string, isExpanded: boolean) => void;
  /** Current search query — matched text in the name is highlighted. Defaults to `''`. */
  searchQuery?: string;
  /** Builds the ⋮ actions of the project. When absent or empty, the trigger is not rendered. */
  getActions?: (project: PinnedProjectGroup) => DropdownItem[];
  /** Called when the ⋮ menu opens; receives the trigger button. */
  onActionMenuOpen?: (
    project: PinnedProjectGroup,
    trigger: HTMLButtonElement,
  ) => void;
  /** Accessible label for the actions trigger button. Defaults to `"More actions"`. */
  actionsLabel?: string;
  /** Accessible name of the chevron of a collapsed project. Defaults to `"Expand project"`. */
  expandLabel?: string;
  /** Accessible name of the chevron of an expanded project. Defaults to `"Collapse project"`. */
  collapseLabel?: string;
  /** Accessible (visually hidden) label announced for the unread dot of a collapsed project. Defaults to `"Unread"`. */
  unreadIndicatorLabel?: string;
  /** Typography class for the project name. Defaults to `'dial-small-text'`. */
  titleClassName?: string;
}

const ProjectRowComponent: FC<ProjectRowProps> = ({
  project,
  isActive,
  isExpanded = true,
  listId,
  onSelectProject,
  onToggleProject,
  searchQuery = '',
  getActions,
  onActionMenuOpen,
  actionsLabel = 'More actions',
  expandLabel = 'Expand project',
  collapseLabel = 'Collapse project',
  unreadIndicatorLabel = 'Unread',
  titleClassName = 'dial-small-text',
}) => {
  const { menuItems, hasActions, isMenuOpen, handleOpenChange, handleOpen } =
    useRowActions(project, getActions, onActionMenuOpen);
  const isToggleable = onToggleProject != null;
  /* A pointer click must not leave focus on the chevron, or `focus-within` would keep it and the ⋮ shown after the pointer leaves. */
  const handleChevronMouseDown = (event: MouseEvent<HTMLButtonElement>) =>
    event.preventDefault();
  const hasUnread =
    !isExpanded && project.conversations.some((item) => item.isUnread);
  const unreadIndicator = hasUnread ? (
    <span className="flex size-6 shrink-0 items-center justify-center">
      <span
        className={mergeClasses(
          'size-[7.11px] rounded-full',
          styles.unreadDot,
          hasActions &&
            (isMenuOpen
              ? 'opacity-0'
              : 'group-focus-within/conversation:opacity-0 group-hover/conversation:opacity-0'),
        )}
        aria-hidden
      />
      <span className="sr-only">{unreadIndicatorLabel}</span>
    </span>
  ) : undefined;

  return (
    <li
      aria-level={1}
      className={mergeClasses('group/conversation relative', styles.row)}
    >
      <RowLink
        href={project.href}
        onSelect={() => onSelectProject(project.id)}
        iconBefore={
          <span
            className={mergeClasses(
              'flex size-6 shrink-0 items-center justify-center',
              isToggleable &&
                (isMenuOpen
                  ? 'opacity-0'
                  : 'group-focus-within/conversation:opacity-0 group-hover/conversation:opacity-0 mobile:opacity-0'),
            )}
          >
            <IconBriefcase
              size={DIAL_ICON_SIZE.SM}
              stroke={DIAL_KIT_ICON_STROKE}
              className={projectStyles.projectIcon}
              aria-hidden
            />
          </span>
        }
        label={
          <Highlight
            text={project.name}
            query={searchQuery}
            className={titleClassName}
            maxLines={1}
          />
        }
        iconAfter={unreadIndicator}
        textClassName="min-w-0 flex-1"
        aria-current={isActive ? 'page' : undefined}
        className={mergeClasses(
          'h-8 w-full justify-start gap-0.5 py-2 ps-2 after:pointer-events-none',
          getButtonPaddingEnd(
            hasActions,
            isMenuOpen,
            ConversationRowVariant.Indicator,
          ),
          styles.item,
          styles.itemIndicator,
          (isActive || isMenuOpen) && styles.itemActive,
        )}
      />
      {isToggleable && (
        <div
          className={mergeClasses(
            'absolute inset-y-0 inset-s-2 flex items-center',
            isMenuOpen
              ? 'opacity-100'
              : 'opacity-0 group-focus-within/conversation:opacity-100 group-hover/conversation:opacity-100 mobile:opacity-100',
          )}
        >
          <GhostIconButton
            type="button"
            icon={
              isExpanded ? (
                <IconChevronDown
                  size={DIAL_ICON_SIZE.SM}
                  stroke={DIAL_KIT_ICON_STROKE}
                  className={projectStyles.projectIcon}
                  aria-hidden
                />
              ) : (
                <IconChevronRight
                  size={DIAL_ICON_SIZE.SM}
                  stroke={DIAL_KIT_ICON_STROKE}
                  className={mergeClasses(
                    projectStyles.projectIcon,
                    'rtl:scale-x-[-1]',
                  )}
                  aria-hidden
                />
              )
            }
            size={ElementSize.Small}
            aria-label={isExpanded ? collapseLabel : expandLabel}
            aria-expanded={isExpanded}
            aria-controls={listId}
            className={mergeClasses(
              'size-6! min-h-0! min-w-0! rounded-full! p-1!',
              styles.trigger,
              projectStyles.chevron,
            )}
            onMouseDown={handleChevronMouseDown}
            onClick={() => onToggleProject(project.id, !isExpanded)}
          />
        </div>
      )}
      {hasActions && (
        <RowActionsMenu
          items={menuItems}
          isOpen={isMenuOpen}
          onOpenChange={handleOpenChange}
          onOpen={handleOpen}
          actionsLabel={actionsLabel}
        />
      )}
    </li>
  );
};

/** A pinned project row of the Pinned section: icon or chevron toggle, name, unread dot of a collapsed project and ⋮ actions. */
export const ProjectRow = memo(ProjectRowComponent);
