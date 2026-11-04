import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Highlight,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import { IconBriefcase } from '@tabler/icons-react';
import { memo, type FC } from 'react';
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
  /** Called with the project `id` when the row is activated. */
  onSelectProject: (projectId: string) => void;
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
  /** Typography class for the project name. Defaults to `'dial-small-text'`. */
  titleClassName?: string;
}

const ProjectRowComponent: FC<ProjectRowProps> = ({
  project,
  isActive,
  onSelectProject,
  searchQuery = '',
  getActions,
  onActionMenuOpen,
  actionsLabel = 'More actions',
  titleClassName = 'dial-small-text',
}) => {
  const { menuItems, hasActions, isMenuOpen, handleOpenChange, handleOpen } =
    useRowActions(project, getActions, onActionMenuOpen);

  return (
    <li aria-level={1} className="group/conversation relative">
      <RowLink
        href={project.href}
        onSelect={() => onSelectProject(project.id)}
        iconBefore={
          <span className="flex size-6 shrink-0 items-center justify-center">
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

/** A pinned project row of the Pinned section: icon, name and ⋮ actions. */
export const ProjectRow = memo(ProjectRowComponent);
