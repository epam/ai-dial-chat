import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  CardShell,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  FolderPath,
  GhostIconButton,
  Highlight,
} from '@epam/ai-dial-ui-kit';
import { IconPin, IconPinFilled } from '@tabler/icons-react';
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
  /** Accessible name of the pin toggle. */
  pinLabel: string;
  /** Called with the project id and its new pinned state; the card shows a pin toggle instead of the static marker when given. */
  onTogglePin?: (id: string, isPinned: boolean) => void;
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

/** List item showing a project's last-updated time, name, pin marker or toggle and folder path on the shared card shell; a link when `href` is given. */
export const ProjectCard: FC<ProjectCardProps> = ({
  project,
  searchQuery,
  sourceLabel,
  folderPathLabel,
  pinnedLabel,
  pinLabel,
  onTogglePin,
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
            'has-focus-visible:translate-y-[-3px] has-focus-visible:shadow-lg motion-reduce:has-focus-visible:translate-y-0',
          href != null && styles.interactive,
        )}
      >
        {project.updatedAt != null && (
          <time
            dateTime={new Date(project.updatedAt).toISOString()}
            className={mergeClasses(
              updatedAtClassName,
              styles.updatedAt,
              (project.isPinned || onTogglePin != null) && 'pe-6',
            )}
          >
            {formatRelativeTime(project.updatedAt, now, locale)}
          </time>
        )}
        <div
          className={mergeClasses(
            'flex min-w-0 items-center',
            (project.isPinned || onTogglePin != null) && 'pe-6',
          )}
        >
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
          {onTogglePin != null ? (
            /* Drawn in the card's top inline-end corner over the stretched
             * link, so it takes its own clicks; unpinned, it shows on hover
             * or focus only where the pointer can hover. */
            <GhostIconButton
              size={ElementSize.Small}
              icon={
                project.isPinned ? (
                  <IconPinFilled size={DIAL_ICON_SIZE.SM} aria-hidden />
                ) : (
                  <IconPin
                    size={DIAL_ICON_SIZE.SM}
                    aria-hidden
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                )
              }
              aria-label={pinLabel}
              aria-pressed={project.isPinned === true}
              onClick={() => onTogglePin(project.id, !project.isPinned)}
              className={mergeClasses(
                'absolute inset-e-4 top-4',
                styles.pinToggle,
                !project.isPinned && styles.pinToggleIdle,
              )}
            />
          ) : (
            project.isPinned && (
              /* Read after the name, drawn in the card's top inline-end corner
               * (the shell's 20px padding); the first row keeps clear of it. */
              <span
                className={mergeClasses(
                  'absolute inset-e-5 top-5 flex',
                  styles.pin,
                )}
              >
                <IconPinFilled size={DIAL_ICON_SIZE.SM} aria-hidden />
                <span className="sr-only">{pinnedLabel}</span>
              </span>
            )
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
