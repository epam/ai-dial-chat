import { Highlight, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialIconButton,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import {
  IconChevronRight,
  IconDotsVertical,
  IconEdit,
  IconFolder,
  IconPlayerPlay,
  IconTrash,
} from '@tabler/icons-react';
import { type FC } from 'react';
import type { ScheduledTaskCardProps } from '../../models/scheduled-task-card-props';
import styles from './ScheduledTaskCard.module.scss';

/** Single scheduled-task card: title, optional "new" badge and description, schedule pill, location breadcrumb, and an overflow menu limited to the actions the caller wired up. Matches the Catalog browse card's visual language (radius, padding, shadow, footer treatment). */
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
    cardStyles?.descriptionClassName ?? 'dial-small-text text-secondary';
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
    <article
      role="group"
      aria-label={item.displayName}
      className={mergeClasses(
        'relative flex h-full flex-col gap-[14px] rounded-[20px] border-2 border-transparent p-[22px]',
        styles.card,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
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
            'line-clamp-2 min-h-[44px] !leading-[22px]',
            descriptionClassName,
          )}
        >
          {item.descriptionPreview}
        </p>
      )}

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
        <div className="mt-auto flex min-w-0 items-center gap-1 border-t border-tertiary pt-3">
          <IconFolder
            size={DIAL_ICON_SIZE.SM}
            className={locationLabelClassName}
            aria-hidden
          />
          {item.locationSegments.map((segment, index, segments) => {
            const isLeaf = index === segments.length - 1;
            return (
              <span
                key={`${segment}-${index}`}
                className="flex min-w-0 items-center gap-1"
              >
                {index > 0 && (
                  <IconChevronRight
                    size={14}
                    className={mergeClasses(
                      locationLabelClassName,
                      'rtl:scale-x-[-1]',
                    )}
                    aria-hidden
                  />
                )}
                <span
                  className={mergeClasses(
                    'truncate',
                    isLeaf ? locationLeafClassName : locationLabelClassName,
                  )}
                >
                  {segment}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </article>
  );
};
