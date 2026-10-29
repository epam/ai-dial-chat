import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  CardShell,
  DIAL_ICON_SIZE,
  FolderPath,
  Highlight,
} from '@epam/ai-dial-ui-kit';
import { IconPinFilled } from '@tabler/icons-react';
import type { FC, MouseEvent } from 'react';
import type { ProjectItem } from '../../models/project-item';
import { formatRelativeTime } from '../../utils/relative-time';
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
  /** Visually hidden text of the pinned marker. */
  pinnedLabel: string;
  /** Link target of the card; the card is not interactive when omitted. */
  href?: string;
  /** Called with the project id on a plain primary click of the card link. */
  onOpen?: (id: string) => void;
  /** Reference time in epoch milliseconds that `updatedAt` is shown relative to. */
  now: number;
  /** BCP 47 locale of the relative last-updated time. Defaults to the runtime locale. */
  locale?: string;
  /** CSS class applied to the last-updated time. */
  updatedAtClassName: string;
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

/* A modified or non-primary click keeps the browser's own behaviour (new
 * tab, new window, download), so only a plain primary click is routed. */
const isPlainPrimaryClick = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

/** List item showing a project's last-updated time, name, pin marker and folder path on the shared card shell; a link when `href` is given. */
export const ProjectCard: FC<ProjectCardProps> = ({
  project,
  searchQuery,
  sourceLabel,
  folderPathLabel,
  pinnedLabel,
  href,
  onOpen,
  now,
  locale,
  updatedAtClassName,
  titleClassName,
  pathLabelClassName,
  pathLeafClassName,
}) => {
  const name = (
    <Highlight
      text={project.name}
      query={searchQuery}
      maxLines={1}
      className={mergeClasses(
        'min-w-0',
        titleClassName,
        styles.title,
        href != null && styles.aboveLink,
      )}
    />
  );

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onOpen == null || !isPlainPrimaryClick(event)) return;
    event.preventDefault();
    onOpen(project.id);
  };

  return (
    <li className="flex min-w-0">
      <CardShell
        aria-label={project.name}
        className={mergeClasses(
          'relative flex w-full min-w-0 flex-col gap-2',
          styles.card,
          /* Keyboard focus gets the kit card's own hover lift and shadow. */
          href != null &&
            'has-focus-visible:-translate-y-[3px] has-focus-visible:shadow-lg motion-reduce:has-focus-visible:translate-y-0',
          href != null && styles.interactive,
        )}
      >
        {project.updatedAt != null && (
          <time
            dateTime={new Date(project.updatedAt).toISOString()}
            className={mergeClasses(updatedAtClassName, styles.updatedAt)}
          >
            {formatRelativeTime(project.updatedAt, now, locale)}
          </time>
        )}
        <div className="flex min-w-0 items-center gap-2">
          {href != null ? (
            <a
              href={href}
              onClick={handleClick}
              className={mergeClasses('min-w-0 flex-1', styles.link)}
            >
              {name}
            </a>
          ) : (
            <div className="min-w-0 flex-1">{name}</div>
          )}
          {project.isPinned && (
            <span className={mergeClasses('shrink-0', styles.pin)}>
              <IconPinFilled size={DIAL_ICON_SIZE.SM} aria-hidden />
              <span className="sr-only">{pinnedLabel}</span>
            </span>
          )}
        </div>
        <FolderPath
          segments={getFolderSegments(sourceLabel, project.parentPath)}
          ariaLabel={folderPathLabel}
          labelClassName={mergeClasses(pathLabelClassName, styles.path)}
          leafClassName={mergeClasses(pathLeafClassName, styles.path)}
          className={mergeClasses(href != null && styles.aboveLink)}
        />
      </CardShell>
    </li>
  );
};
