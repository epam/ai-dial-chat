import {
  ActionMenu,
  buildCssVars,
  mergeClasses,
  PanelEmptyState,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  type DropdownItem,
  ElementSize,
  EllipsisTooltip,
  GhostButton,
  GhostIconButton,
  LinkButton,
  LiveRegion,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconDotsVertical } from '@tabler/icons-react';
import { type FC, memo, useId, useMemo, useState } from 'react';
import type {
  ProjectConversationListItem,
  ProjectConversationListLabels,
  ProjectConversationListProps,
} from '../../models/project-conversation-list-props';
import styles from './ProjectConversationList.module.scss';

interface RowProps {
  item: ProjectConversationListItem;
  labels: ProjectConversationListLabels;
  rowTitleClassName: string;
  unreadRowTitleClassName: string;
  onOpen: (id: string) => void;
  onRename?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const ConversationRow: FC<RowProps> = ({
  item,
  labels,
  rowTitleClassName,
  unreadRowTitleClassName,
  onOpen,
  onRename,
  onDelete,
}) => {
  const unreadId = useId();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isUnread = item.isUnread === true;
  const menuItems = useMemo<DropdownItem[]>(
    () => [
      ...(onRename
        ? [
            {
              key: 'rename',
              label: labels.renameLabel,
              onClick: () => onRename(item.id),
            },
          ]
        : []),
      ...(onDelete
        ? [
            {
              key: 'delete',
              label: labels.deleteLabel,
              danger: true,
              onClick: () => onDelete(item.id),
            },
          ]
        : []),
    ],
    [item.id, labels.deleteLabel, labels.renameLabel, onDelete, onRename],
  );

  return (
    <li
      className={mergeClasses(
        'group/row flex min-w-0 items-center gap-1 rounded-xl',
        styles.row,
      )}
    >
      <button
        type="button"
        aria-label={labels.openLabel(item.title, item.authorName)}
        aria-describedby={isUnread ? unreadId : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3 text-start focus-visible:outline-2 focus-visible:-outline-offset-2"
        onClick={() => onOpen(item.id)}
      >
        {/* The host's leading visual, else the status point: an outline when read, filled when unread. */}
        {item.leading ?? (
          <span
            aria-hidden
            className="flex size-4 shrink-0 items-center justify-center"
          >
            <span
              className={mergeClasses(
                'size-[7.11px] rounded-full',
                isUnread ? styles.unreadDot : styles.readDot,
              )}
            />
          </span>
        )}
        <EllipsisTooltip
          text={item.title}
          className={mergeClasses(
            'min-w-0 flex-1',
            isUnread ? unreadRowTitleClassName : rowTitleClassName,
          )}
        />
        {/* The host's trailing visual, else — beside a host `leading` node, which replaces the status point — the unread dot. */}
        {item.trailing ??
          (isUnread && item.leading != null && (
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center"
            >
              <span
                className={mergeClasses(
                  'size-[7.11px] rounded-full',
                  styles.unreadDot,
                )}
              />
            </span>
          ))}
      </button>
      {isUnread && (
        <span id={unreadId} className="sr-only">
          {labels.unreadLabel ?? 'Unread'}
        </span>
      )}
      {menuItems.length > 0 && (
        <ActionMenu
          items={menuItems}
          title={labels.moreActionsLabel(item.title)}
          closeLabel={labels.closeLabel}
          placement="bottom-end"
          onOpenChange={setIsMenuOpen}
        >
          {/* On desktop the trigger shows on hover, focus or while its menu is open; touch screens have no hover, so it always shows there. */}
          <GhostIconButton
            aria-label={labels.moreActionsLabel(item.title)}
            size={ElementSize.Small}
            className={mergeClasses(
              'me-2 shrink-0',
              !isMenuOpen &&
                'desktop:opacity-0 desktop:group-focus-within/row:opacity-100 desktop:group-hover/row:opacity-100',
            )}
            icon={
              <IconDotsVertical
                aria-hidden
                size={DIAL_ICON_SIZE.SM}
                stroke={DIAL_KIT_ICON_STROKE}
              />
            }
          />
        </ActionMenu>
      )}
    </li>
  );
};

const ProjectConversationListComponent: FC<ProjectConversationListProps> = ({
  items,
  isLoading = false,
  hasError = false,
  onRetry,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  isEmptyStateShown = true,
  onOpen,
  onRename,
  onDelete,
  labels,
  typography,
  colors,
}) => {
  const headingId = useId();
  const titleClassName = typography?.titleClassName ?? 'dial-body-semi-text';
  const rowTitleClassName = typography?.rowTitleClassName ?? 'dial-body-text';
  const unreadRowTitleClassName =
    typography?.unreadRowTitleClassName ?? 'dial-body-semi-text';
  const cssVars = useMemo(
    () =>
      buildCssVars({
        '--pcl-read-dot': colors?.readDot,
        '--pcl-unread-dot': colors?.unreadDot,
        '--pcl-row-hover': colors?.rowHoverBackground,
      }),
    [colors?.readDot, colors?.unreadDot, colors?.rowHoverBackground],
  );
  const messageClassName = typography?.messageClassName ?? 'dial-small-text';
  /* The design shows only the empty state, with no Chats heading, while the project has no chats. */
  const isEmpty = !isLoading && !hasError && items.length === 0;

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-6">
          {/* The kit spinner is a status of its own; the section's live region carries the localized text instead. */}
          <span aria-hidden>
            <Spinner />
          </span>
        </div>
      );
    }
    if (hasError) {
      return (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p aria-hidden className={mergeClasses('m-0', messageClassName)}>
            {labels.errorLabel}
          </p>
          <GhostButton label={labels.retryLabel} onClick={onRetry} />
        </div>
      );
    }
    if (isEmpty) {
      return (
        <div aria-hidden>
          <PanelEmptyState
            label={labels.emptyTitle}
            description={labels.emptyDescription}
          />
        </div>
      );
    }
    return (
      <>
        <ul className="m-0 flex min-w-0 list-none flex-col gap-2 p-0">
          {items.map((item) => (
            <ConversationRow
              key={item.id}
              item={item}
              labels={labels}
              rowTitleClassName={rowTitleClassName}
              unreadRowTitleClassName={unreadRowTitleClassName}
              onOpen={onOpen}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
        {hasMore && onLoadMore && (
          <LinkButton
            className="self-start"
            label={labels.loadMoreLabel ?? 'See more'}
            disabled={isLoadingMore}
            onClick={onLoadMore}
          />
        )}
      </>
    );
  };

  const renderStatus = () => {
    if (isLoading) return labels.loadingLabel;
    if (hasError) return labels.errorLabel;
    if (isEmpty) {
      return (
        <>
          <span>{labels.emptyTitle}</span>{' '}
          <span>{labels.emptyDescription}</span>
        </>
      );
    }
    return null;
  };

  if (isEmpty && !isEmptyStateShown) return null;

  return (
    <section
      aria-labelledby={isEmpty ? undefined : headingId}
      aria-label={isEmpty ? labels.title : undefined}
      className="flex min-w-0 flex-col gap-2 pt-3"
      style={cssVars}
    >
      {!isEmpty && (
        <h2 id={headingId} className={mergeClasses('m-0', titleClassName)}>
          {labels.title}
        </h2>
      )}
      {/* Mounted across loading, error and empty so each state is announced when it replaces the previous one. */}
      <LiveRegion visuallyHidden>{renderStatus()}</LiveRegion>
      {renderBody()}
    </section>
  );
};

/** A project's conversations as a list of rows that open a chat, with an optional Rename/Delete menu per row. */
export const ProjectConversationList = memo(ProjectConversationListComponent);
