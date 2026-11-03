import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Button } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import type {
  NestedRowPosition,
  PinnedProjectGroup,
} from '../../models/pinned-projects';
import styles from '../ConversationPanel/ConversationPanel.module.scss';
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
  const accessibleName = ariaLabel(project.name);

  return (
    <li
      aria-level={2}
      aria-posinset={position.posInSet}
      aria-setsize={position.setSize}
      className={mergeClasses(
        'relative ps-7',
        projectStyles.guideLine,
        position.isFirstNested && projectStyles.guideLineFirst,
        position.isLastNested && projectStyles.guideLineLast,
      )}
    >
      <a
        href={project.href}
        aria-label={project.href ? accessibleName : undefined}
        className="contents"
        onClick={(e) => {
          if (!project.href) return;
          e.preventDefault();
          onSeeAll(project.id);
        }}
      >
        <Button
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
          aria-label={accessibleName}
          textClassName="min-w-0 flex-1"
          onClick={project.href ? undefined : () => onSeeAll(project.id)}
          tabIndex={project.href ? -1 : undefined}
          className={mergeClasses(
            'h-8 w-full justify-start py-2 ps-2 pe-2 after:pointer-events-none',
            styles.item,
            styles.itemIndicator,
          )}
        />
      </a>
    </li>
  );
};

/** The See all link closing a pinned project's nested chats; it has no actions. */
export const ProjectSeeAllRow = memo(ProjectSeeAllRowComponent);
