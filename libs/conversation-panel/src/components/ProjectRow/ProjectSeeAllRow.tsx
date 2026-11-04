import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { memo, type FC } from 'react';
import type {
  NestedRowPosition,
  PinnedProjectGroup,
} from '../../models/pinned-projects';
import { getNestedRowProps } from '../../utils/conversation-row';
import styles from '../ConversationPanel/ConversationPanel.module.scss';
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
  titleClassName = 'dial-small-text',
}) => {
  const nestedRowProps = getNestedRowProps(position);

  return (
    <li
      {...nestedRowProps}
      className={mergeClasses('relative', nestedRowProps.className)}
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
          'h-8 w-full justify-start py-2 ps-2 pe-2 after:pointer-events-none',
          styles.item,
          styles.itemIndicator,
        )}
      />
    </li>
  );
};

/** The See all link closing a pinned project's nested chats; it has no actions. */
export const ProjectSeeAllRow = memo(ProjectSeeAllRowComponent);
