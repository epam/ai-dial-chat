import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Highlight } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import type { ProjectItem } from '../../models/project-item';
import styles from './ProjectCard.module.scss';

/** Props for the {@link ProjectCard} component. */
export interface ProjectCardProps {
  /** Project rendered by the card. */
  project: ProjectItem;
  /** Trimmed search query whose match is highlighted in the name. */
  searchQuery: string;
  /** Text of the source badge. */
  sourceLabel: string;
  /** Formats the last-updated time as display text. */
  formatUpdatedAt: (timestamp: number) => string;
  /** CSS class applied to the project name. */
  titleClassName: string;
  /** CSS class applied to the source badge. */
  badgeClassName: string;
  /** CSS class applied to the last-updated date. */
  metaClassName: string;
}

/** Non-interactive list item showing a project's name, source and last-updated date. */
export const ProjectCard: FC<ProjectCardProps> = ({
  project,
  searchQuery,
  sourceLabel,
  formatUpdatedAt,
  titleClassName,
  badgeClassName,
  metaClassName,
}) => (
  <li
    className={mergeClasses(
      'flex min-w-0 flex-col gap-2 rounded-lg border p-4',
      styles.card,
    )}
  >
    <Highlight
      text={project.name}
      query={searchQuery}
      maxLines={2}
      className={mergeClasses(
        'min-w-0 break-words',
        titleClassName,
        styles.title,
      )}
    />
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span
        className={mergeClasses(
          'w-fit shrink-0 rounded px-2 py-0.5',
          badgeClassName,
          styles.badge,
        )}
      >
        {sourceLabel}
      </span>
      {project.updatedAt != null && (
        <time
          dateTime={new Date(project.updatedAt).toISOString()}
          className={mergeClasses('min-w-0', metaClassName, styles.meta)}
        >
          {formatUpdatedAt(project.updatedAt)}
        </time>
      )}
    </div>
  </li>
);
