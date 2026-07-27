import { Highlight, mergeClasses } from '@epam/ai-dial-chat-shared';
import { FolderPath } from '@epam/ai-dial-kit';
import {
  CardShell,
  DIAL_ICON_SIZE,
  DialDropdown,
  DialIconButton,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import {
  IconDotsVertical,
  IconEdit,
  IconPlayerPlay,
  IconTrash,
} from '@tabler/icons-react';
import { type FC } from 'react';
import type { ScheduledTaskCardProps } from '../../models/scheduled-task-card-props';

/**
 * Single scheduled-task card: title, optional "new" badge and description,
 * schedule pill, location breadcrumb, and an overflow menu limited to the
 * actions the caller wired up. Renders on the shared `CardShell` from
 * `@epam/ai-dial-ui-kit` (radius, padding, shadow, hover lift), the same shell
 * the Catalog browse card uses. The card has a fixed height; a long
 * description is clamped with an ellipsis, and the schedule pill (plus the
 * location breadcrumb, when present) is pinned to the bottom regardless of
 * description length.
 */
export const ScheduledTaskCard: FC<ScheduledTaskCardProps> = ({
  item,
  searchQuery = '',
  onEdit,
  onRunNow,
  onDelete,
  labels,
  styles: cardStyles,
  className,
}) => {
  const newBadgeLabel = labels?.newBadgeLabel ?? 'NEW';
  const actionsLabel = labels?.actionsLabel ?? 'More actions';
  const editActionLabel = labels?.editActionLabel ?? 'Edit';
  const runNowActionLabel = labels?.runNowActionLabel ?? 'Run now';
  const deleteActionLabel = labels?.deleteActionLabel ?? 'Delete';

  const titleClassName =
    cardStyles?.titleClassName ?? 'dial-body-semi-text text-primary';
  const descriptionClassName =
    cardStyles?.descriptionClassName ?? 'dial-small-text text-control-disable';
  const schedulePillClassName =
    cardStyles?.schedulePillClassName ?? 'bg-layer-2 border border-tertiary';
  const scheduleLabelClassName =
    cardStyles?.scheduleLabelClassName ?? 'dial-tiny-text text-control-disable';
  const locationLabelClassName =
    cardStyles?.locationLabelClassName ?? 'dial-tiny-text text-secondary';
  const locationLeafClassName =
    cardStyles?.locationLeafClassName ?? 'dial-tiny-semi-text text-secondary';
  const newBadgeClassName =
    cardStyles?.newBadgeClassName ??
    'bg-accent-primary text-controls-permanent';

  const menuItems: DropdownItem[] = [];
  if (onEdit) {
    menuItems.push({
      key: 'edit',
      label: editActionLabel,
      icon: <IconEdit size={DIAL_ICON_SIZE.SM} aria-hidden />,
      onClick: () => onEdit(item.id),
    });
  }
  if (onRunNow) {
    menuItems.push({
      key: 'runNow',
      label: runNowActionLabel,
      icon: <IconPlayerPlay size={DIAL_ICON_SIZE.SM} aria-hidden />,
      onClick: () => onRunNow(item.id),
    });
  }
  if (onDelete) {
    menuItems.push({
      key: 'delete',
      label: deleteActionLabel,
      icon: <IconTrash size={DIAL_ICON_SIZE.SM} aria-hidden />,
      danger: true,
      onClick: () => onDelete(item.id),
    });
  }

  return (
    <CardShell
      role="group"
      aria-label={item.displayName}
      className={mergeClasses('h-[232px]', className)}
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Highlight
            text={item.displayName}
            query={searchQuery}
            maxLines={1}
            className={titleClassName}
          />
          {item.isNew && (
            <span
              className={mergeClasses(
                'dial-tiny-semi-text shrink-0 rounded-full px-2 py-0.5',
                newBadgeClassName,
              )}
            >
              {newBadgeLabel}
            </span>
          )}
        </div>

        {menuItems.length > 0 && (
          <DialDropdown
            items={menuItems}
            matchReferenceWidth={false}
            placement="bottom-end"
          >
            <DialIconButton
              icon={<IconDotsVertical size={DIAL_ICON_SIZE.SM} aria-hidden />}
              aria-label={actionsLabel}
              className="shrink-0"
            />
          </DialDropdown>
        )}
      </div>

      {item.descriptionPreview && (
        <p
          className={mergeClasses(
            'line-clamp-4 min-h-0 flex-1 overflow-hidden !leading-[22px]',
            descriptionClassName,
          )}
        >
          {item.descriptionPreview}
        </p>
      )}

      <div className="mt-auto flex shrink-0 flex-col gap-3">
        <div className="flex min-h-[28px] items-center">
          <span
            className={mergeClasses(
              'inline-block rounded-lg px-2 py-1',
              schedulePillClassName,
              scheduleLabelClassName,
            )}
          >
            {item.scheduleLabel}
          </span>
        </div>

        {item.locationSegments && item.locationSegments.length > 0 && (
          <FolderPath
            segments={item.locationSegments}
            labelClassName={locationLabelClassName}
            leafClassName={locationLeafClassName}
            className="border-t border-tertiary pt-3"
          />
        )}
      </div>
    </CardShell>
  );
};
