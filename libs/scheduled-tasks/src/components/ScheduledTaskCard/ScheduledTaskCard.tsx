import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  CardShell,
  DIAL_ICON_SIZE,
  Dropdown,
  type DropdownItem,
  FolderPath,
  Highlight,
  IconButton,
} from '@epam/ai-dial-ui-kit';
import {
  IconDotsVertical,
  IconEdit,
  IconPlayerPause,
  IconPlayerPlay,
  IconTrash,
} from '@tabler/icons-react';
import type { FC, KeyboardEvent, MouseEvent } from 'react';
import type { ScheduledTaskCardProps } from '../../models/scheduled-task-card-props';
import styles from './ScheduledTaskCard.module.scss';

/**
 * Single scheduled-task card: title, optional "new" badge and description,
 * schedule pill (replaced by a "Paused" badge when `item.isActive` is
 * `false`), location breadcrumb, and an overflow menu limited to the actions
 * the caller wired up. Renders on the shared `CardShell` from
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
  onCardClick,
  labels,
  styles: cardStyles,
  className,
}) => {
  const newBadgeLabel = labels?.newBadgeLabel ?? 'NEW';
  const actionsLabel = labels?.actionsLabel ?? 'More actions';
  const editActionLabel = labels?.editActionLabel ?? 'Edit';
  const runNowActionLabel = labels?.runNowActionLabel ?? 'Run now';
  const deleteActionLabel = labels?.deleteActionLabel ?? 'Delete';
  const pausedBadgeLabel = labels?.pausedBadgeLabel ?? 'Paused';

  const { colors, typography } = cardStyles ?? {};
  const titleClassName = typography?.titleClassName ?? 'dial-body-semi-text';
  const descriptionClassName =
    typography?.descriptionClassName ?? 'dial-small-text';
  const scheduleLabelClassName =
    typography?.scheduleLabelClassName ?? 'dial-tiny-text';
  const locationLabelClassName =
    typography?.locationLabelClassName ?? 'dial-tiny-text';
  const locationLeafClassName =
    typography?.locationLeafClassName ?? 'dial-tiny-semi-text';
  const newBadgeClassName =
    typography?.newBadgeClassName ?? 'dial-tiny-semi-text';
  const pausedBadgeClassName =
    typography?.pausedBadgeClassName ?? 'dial-tiny-text';
  const cssVars = buildCssVars({
    '--stc-title-text': colors?.titleText,
    '--stc-desc-text': colors?.descriptionText,
    '--stc-pill-bg': colors?.schedulePillBackground,
    '--stc-pill-border': colors?.schedulePillBorder,
    '--stc-schedule-label-text': colors?.scheduleLabelText,
    '--stc-location-label-text': colors?.locationLabelText,
    '--stc-location-leaf-text': colors?.locationLeafText,
    '--stc-new-badge-bg': colors?.newBadgeBackground,
    '--stc-new-badge-text': colors?.newBadgeText,
    '--stc-location-divider-border': colors?.locationDividerBorder,
    '--stc-paused-bg': colors?.pausedBadgeBackground,
    '--stc-paused-border': colors?.pausedBadgeBorder,
    '--stc-paused-text': colors?.pausedBadgeText,
  });

  const menuItems: DropdownItem[] = [];
  if (onEdit) {
    menuItems.push({
      key: 'edit',
      label: editActionLabel,
      icon: <IconEdit size={DIAL_ICON_SIZE.SM} aria-hidden />,
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        onEdit(item.id);
      },
    });
  }
  if (onRunNow) {
    menuItems.push({
      key: 'runNow',
      label: runNowActionLabel,
      icon: <IconPlayerPlay size={DIAL_ICON_SIZE.SM} aria-hidden />,
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        onRunNow(item.id);
      },
    });
  }
  if (onDelete) {
    menuItems.push({
      key: 'delete',
      label: deleteActionLabel,
      icon: <IconTrash size={DIAL_ICON_SIZE.SM} aria-hidden />,
      danger: true,
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        onDelete(item.id);
      },
    });
  }

  const cardClickProps = onCardClick
    ? {
        tabIndex: 0,
        onClick: () => onCardClick(item.id),
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onCardClick(item.id);
          }
        },
      }
    : {};

  return (
    <CardShell
      role={onCardClick ? 'button' : 'group'}
      aria-label={item.displayName}
      style={cssVars}
      className={mergeClasses(
        'h-[232px]',
        onCardClick && 'cursor-pointer',
        className,
      )}
      {...cardClickProps}
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Highlight
            text={item.displayName}
            query={searchQuery}
            maxLines={1}
            className={mergeClasses(titleClassName, styles.title)}
          />
          {item.isNew && (
            <span
              className={mergeClasses(
                'shrink-0 rounded-full px-2 py-0.5',
                newBadgeClassName,
                styles.newBadge,
              )}
            >
              {newBadgeLabel}
            </span>
          )}
        </div>

        {menuItems.length > 0 && (
          <Dropdown
            items={menuItems}
            matchReferenceWidth={false}
            placement="bottom-end"
          >
            <IconButton
              icon={<IconDotsVertical size={DIAL_ICON_SIZE.SM} aria-hidden />}
              aria-label={actionsLabel}
              className="shrink-0"
              onClick={(event: MouseEvent) => event.stopPropagation()}
            />
          </Dropdown>
        )}
      </div>

      {item.descriptionPreview && (
        <p
          className={mergeClasses(
            'line-clamp-4 min-h-0 flex-1 overflow-hidden !leading-[22px]',
            descriptionClassName,
            styles.description,
          )}
        >
          {item.descriptionPreview}
        </p>
      )}

      <div className="mt-auto flex shrink-0 flex-col gap-3">
        <div className="flex min-h-[28px] items-center">
          {item.isActive === false ? (
            <span
              className={mergeClasses(
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-1',
                styles.pausedPill,
                pausedBadgeClassName,
                styles.pausedLabel,
              )}
            >
              <IconPlayerPause size={DIAL_ICON_SIZE.SM} aria-hidden />
              {pausedBadgeLabel}
            </span>
          ) : (
            <span
              className={mergeClasses(
                'inline-block rounded-lg border px-2 py-1',
                styles.schedulePill,
                scheduleLabelClassName,
                styles.scheduleLabel,
              )}
            >
              {item.scheduleLabel}
            </span>
          )}
        </div>

        {item.locationSegments && item.locationSegments.length > 0 && (
          <FolderPath
            segments={item.locationSegments}
            labelClassName={mergeClasses(
              locationLabelClassName,
              styles.locationLabel,
            )}
            leafClassName={mergeClasses(
              locationLeafClassName,
              styles.locationLeaf,
            )}
            className={mergeClasses('pt-3', styles.locationDivider)}
          />
        )}
      </div>
    </CardShell>
  );
};
