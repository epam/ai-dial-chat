import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  EllipsisTooltip,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconArrowNarrowLeft } from '@tabler/icons-react';
import { type FC, memo } from 'react';
import type { ProjectChatHeaderProps } from '../../models/project-chat-header-props';

const ProjectChatHeaderComponent: FC<ProjectChatHeaderProps> = ({
  projectName,
  projectHref,
  onBack,
  onProjectLinkClick,
  backLabel,
  className,
  nameClassName = 'dial-body-text',
}) => (
  <nav
    aria-label={backLabel}
    className={mergeClasses(
      'flex min-w-0 shrink-0 items-center gap-2 border-b px-4 py-2',
      className,
    )}
  >
    <GhostIconButton
      aria-label={backLabel}
      icon={
        <IconArrowNarrowLeft
          aria-hidden
          size={DIAL_ICON_SIZE.MD}
          stroke={DIAL_KIT_ICON_STROKE}
          className="rtl:scale-x-[-1]"
        />
      }
      onClick={onBack}
    />
    <a
      href={projectHref}
      onClick={onProjectLinkClick}
      className="min-w-0 hover:underline focus-visible:underline"
    >
      <EllipsisTooltip
        text={projectName}
        className={mergeClasses('min-w-0', nameClassName)}
      />
    </a>
  </nav>
);

/** Breadcrumb bar of a project chat: a back button and the project name linking to the project. */
export const ProjectChatHeader = memo(ProjectChatHeaderComponent);
