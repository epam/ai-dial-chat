import {
  InitialsAvatar,
  mergeClasses,
  PanelEmptyState,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  type DropdownItem,
  ElementSize,
  EllipsisTooltip,
  GhostButton,
  GhostIconButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconDotsVertical } from '@tabler/icons-react';
import { type FC, memo, useId, useMemo } from 'react';
import type {
  ProjectConversationListItem,
  ProjectConversationListLabels,
  ProjectConversationListProps,
} from '../../models/project-conversation-list-props';

const AVATAR_SIZE = 24;

interface RowProps {
  item: ProjectConversationListItem;
  labels: ProjectConversationListLabels;
  rowTitleClassName: string;
  onOpen: (id: string) => void;
  onRename?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const ConversationRow: FC<RowProps> = ({
  item,
  labels,
  rowTitleClassName,
  onOpen,
  onRename,
  onDelete,
}) => {
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
    <li className="flex min-w-0 items-center gap-1 rounded focus-within:bg-(--bg-accent-primary-alpha,rgba(92,141,234,0.15)) hover:bg-(--bg-accent-primary-alpha,rgba(92,141,234,0.15))">
      <button
        type="button"
        aria-label={labels.openLabel(item.title, item.authorName)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded px-3 py-2 text-start focus-visible:outline-2 focus-visible:-outline-offset-2"
        onClick={() => onOpen(item.id)}
      >
        <span aria-hidden className="shrink-0">
          <InitialsAvatar name={item.authorName ?? ''} size={AVATAR_SIZE} />
        </span>
        <EllipsisTooltip
          text={item.title}
          className={mergeClasses('min-w-0 flex-1', rowTitleClassName)}
        />
      </button>
      {menuItems.length > 0 && (
        <Dropdown items={menuItems} placement="bottom-end">
          <GhostIconButton
            aria-label={labels.moreActionsLabel(item.title)}
            size={ElementSize.Small}
            className="me-2 shrink-0"
            icon={
              <IconDotsVertical
                aria-hidden
                size={DIAL_ICON_SIZE.SM}
                stroke={DIAL_KIT_ICON_STROKE}
              />
            }
          />
        </Dropdown>
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
  onOpen,
  onRename,
  onDelete,
  labels,
  typography,
}) => {
  const headingId = useId();
  const titleClassName = typography?.titleClassName ?? 'dial-body-semi-text';
  const rowTitleClassName = typography?.rowTitleClassName ?? 'dial-body-text';
  const messageClassName = typography?.messageClassName ?? 'dial-small-text';
  /* The design shows only the empty state, with no Chats heading, while the project has no chats. */
  const isEmpty = !isLoading && !hasError && items.length === 0;

  const renderBody = () => {
    if (isLoading) {
      return (
        <div role="status" className="flex justify-center py-6">
          {/* The kit spinner is a status of its own; the region below carries the localized text instead. */}
          <span aria-hidden>
            <Spinner />
          </span>
          <span className="sr-only">{labels.loadingLabel}</span>
        </div>
      );
    }
    if (hasError) {
      return (
        <div
          role="status"
          className="flex flex-col items-center gap-3 py-6 text-center"
        >
          <p className={mergeClasses('m-0', messageClassName)}>
            {labels.errorLabel}
          </p>
          <GhostButton label={labels.retryLabel} onClick={onRetry} />
        </div>
      );
    }
    if (isEmpty) {
      return (
        <div role="status">
          <PanelEmptyState
            label={labels.emptyTitle}
            description={labels.emptyDescription}
          />
        </div>
      );
    }
    return (
      <>
        <ul className="m-0 flex min-w-0 list-none flex-col gap-1 p-0">
          {items.map((item) => (
            <ConversationRow
              key={item.id}
              item={item}
              labels={labels}
              rowTitleClassName={rowTitleClassName}
              onOpen={onOpen}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
        {hasMore && onLoadMore && (
          <GhostButton
            className="self-center"
            label={labels.loadMoreLabel ?? 'Show more'}
            disabled={isLoadingMore}
            onClick={onLoadMore}
          />
        )}
      </>
    );
  };

  return (
    <section
      aria-labelledby={isEmpty ? undefined : headingId}
      aria-label={isEmpty ? labels.title : undefined}
      className="flex min-w-0 flex-col gap-2"
    >
      {!isEmpty && (
        <h2 id={headingId} className={mergeClasses('m-0', titleClassName)}>
          {labels.title}
        </h2>
      )}
      {renderBody()}
    </section>
  );
};

/** A project's conversations as a list of rows that open a chat, with an optional Rename/Delete menu per row. */
export const ProjectConversationList = memo(ProjectConversationListComponent);
