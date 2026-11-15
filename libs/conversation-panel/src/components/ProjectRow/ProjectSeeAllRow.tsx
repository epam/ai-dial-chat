import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { useRowActions } from '../../hooks/useRowActions';
import type {
  NestedRowPosition,
  PinnedProjectGroup,
} from '../../models/pinned-projects';
import { ConversationRowVariant } from '../../types/conversation-row-variant';
import {
  getButtonPaddingEnd,
  getNestedRowProps,
} from '../../utils/conversation-row';
import styles from '../ConversationPanel/ConversationPanel.module.scss';
import { RowActionsMenu } from '../RowActionsMenu/RowActionsMenu';
import { RowLink } from '../RowLink/RowLink';
import projectStyles from './ProjectRow.module.scss';

/** Props for `ProjectSeeAllRow`. */
export interface ProjectSeeAllRowProps {
  /** The project whose chats the row opens. */
  project: PinnedProjectGroup;
  /** Position of the row among the project's nested rows. */
  position: NestedRowPosition;
  /** Called with the project `id` when the row is activated. */
  onSeeAll: (projectId: string) => void;
  /** Visible text of the row. Defaults to `'See all'`. */
  label?: string;
  /** Builds the accessible name of the row from the project name. Defaults to `` (name) => `See all chats in ${name}` ``. */
  ariaLabel?: (name: string) => string;
  /** Builds the ⋮ actions of the project, the same items its project row offers. When absent or empty, the trigger is not rendered. */
  getActions?: (project: PinnedProjectGroup) => DropdownItem[];
  /** Called when the ⋮ menu opens; receives the trigger button. */
  onActionMenuOpen?: (
    project: PinnedProjectGroup,
    trigger: HTMLButtonElement,
  ) => void;
  /** Accessible label for the actions trigger button. Defaults to `"More actions"`. */
  actionsLabel?: string;
  /** Typography class for the row text. Defaults to `'dial-small-text'`. */
  titleClassName?: string;
}

const defaultAriaLabel = (name: string) => `See all chats in ${name}`;

const ProjectSeeAllRowComponent: FC<ProjectSeeAllRowProps> = ({
  project,
  position,
  onSeeAll,
  label = 'See all',
  ariaLabel = defaultAriaLabel,
  getActions,
  onActionMenuOpen,
  actionsLabel = 'More actions',
  titleClassName = 'dial-small-text',
}) => {
  const { menuItems, hasActions, isMenuOpen, handleOpenChange, handleOpen } =
    useRowActions(project, getActions, onActionMenuOpen);
  const nestedRowProps = getNestedRowProps(position);

  return (
    <li
      {...nestedRowProps}
      className={mergeClasses(
        'group/conversation relative',
        styles.row,
        nestedRowProps.className,
      )}
    >
      <RowLink
        href={project.href}
        onSelect={() => onSeeAll(project.id)}
        label={
          <span
            className={mergeClasses(
              /* The kit button centres its text; the row label starts at the inline start. */
              'block truncate text-start',
              titleClassName,
              projectStyles.seeAllText,
            )}
          >
            {label}
          </span>
        }
        aria-label={ariaLabel(project.name)}
        textClassName="min-w-0 flex-1"
        className={mergeClasses(
          'h-8 w-full justify-start py-2 ps-2 after:pointer-events-none',
          getButtonPaddingEnd(
            hasActions,
            isMenuOpen,
            ConversationRowVariant.Indicator,
          ),
          styles.item,
          styles.itemIndicator,
          isMenuOpen && styles.itemActive,
        )}
      />
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

/** The See all link closing a pinned project's nested chats, with the project's ⋮ actions. */
export const ProjectSeeAllRow = memo(ProjectSeeAllRowComponent);
