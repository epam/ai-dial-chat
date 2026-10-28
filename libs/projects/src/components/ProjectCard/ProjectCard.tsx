import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { CardShell, FolderPath, Highlight } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import type { ProjectItem } from '../../models/project-item';
import styles from './ProjectCard.module.scss';

/** Props for the {@link ProjectCard} component. */
export interface ProjectCardProps {
  /** Project rendered by the card. */
  project: ProjectItem;
  /** Trimmed search query whose match is highlighted in the name. */
  searchQuery: string;
  /** Label of the project's source, the first folder path segment. */
  sourceLabel: string;
  /** Accessible name of the folder path. */
  folderPathLabel: string;
  /** CSS class applied to the project name. */
  titleClassName: string;
  /** CSS class applied to the non-leaf folder path segments. */
  pathLabelClassName: string;
  /** CSS class applied to the last folder path segment. */
  pathLeafClassName: string;
}

const getFolderSegments = (sourceLabel: string, parentPath?: string) => [
  sourceLabel,
  ...(parentPath ?? '').split('/').filter((segment) => segment.length > 0),
];

/** Non-interactive list item showing a project's name and folder path on the shared card shell. */
export const ProjectCard: FC<ProjectCardProps> = ({
  project,
  searchQuery,
  sourceLabel,
  folderPathLabel,
  titleClassName,
  pathLabelClassName,
  pathLeafClassName,
}) => (
  <li className="flex min-w-0">
    <CardShell
      aria-label={project.name}
      className={mergeClasses(
        'flex w-full min-w-0 flex-col gap-3',
        styles.card,
      )}
    >
      <Highlight
        text={project.name}
        query={searchQuery}
        maxLines={1}
        className={mergeClasses('min-w-0', titleClassName, styles.title)}
      />
      <FolderPath
        segments={getFolderSegments(sourceLabel, project.parentPath)}
        ariaLabel={folderPathLabel}
        labelClassName={mergeClasses(pathLabelClassName, styles.path)}
        leafClassName={mergeClasses(pathLeafClassName, styles.path)}
        className={mergeClasses('mt-auto pt-3', styles.footer)}
      />
    </CardShell>
  </li>
);
