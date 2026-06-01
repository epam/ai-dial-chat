import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from '@tabler/icons-react';
import { type FC, memo } from 'react';
import type { ConversationHistoryPanelProps } from '../../models/ConversationHistoryPanel.js';
import styles from './ConversationHistoryPanel.module.scss';

/** Collapsible left-side panel showing the user's conversation history. */
export const ConversationHistoryPanel: FC<ConversationHistoryPanelProps> = memo(
  ({
    conversations,
    isOpen,
    onToggle,
    onSelectConversation,
    activeConversationId,
    title,
    toggleAriaLabel,
    emptyLabel,
    formatDate,
    colors,
    className,
    onBackdropClick,
  }) => {
    const cssVars = buildCssVars({
      '--ch-bg': colors?.background,
      '--ch-border': colors?.border,
      '--ch-header-border': colors?.headerBorder,
      '--ch-item-hover': colors?.itemHover,
      '--ch-item-active': colors?.itemActive,
      '--ch-text': colors?.text,
      '--ch-text-secondary': colors?.textSecondary,
    });

    const ToggleIcon = isOpen
      ? IconLayoutSidebarLeftCollapse
      : IconLayoutSidebarLeftExpand;

    return (
      <>
        {isOpen && onBackdropClick && (
          <div
            className="bg-black/40 fixed inset-0 z-40"
            aria-hidden="true"
            onClick={onBackdropClick}
          />
        )}

        <aside
          aria-label={title}
          aria-expanded={isOpen}
          style={cssVars}
          className={mergeClasses(
            'relative z-50 flex h-full flex-shrink-0 flex-col overflow-hidden border-r',
            'transition-[width] duration-200 ease-in-out',
            isOpen ? 'w-[280px]' : 'w-0',
            styles.panel,
            className,
          )}
        >
          {/* Header bar */}
          <div
            className={mergeClasses(
              'flex h-12 shrink-0 items-center justify-between border-b px-2',
              styles.header,
            )}
          >
            <span className="truncate px-2 text-sm font-semibold">{title}</span>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p
                className={mergeClasses(
                  'px-4 py-6 text-center text-sm',
                  styles.itemDate,
                )}
              >
                {emptyLabel}
              </p>
            ) : (
              <ul role="list" className="flex flex-col py-1">
                {conversations.map((item) => {
                  const isActive = item.id === activeConversationId;
                  return (
                    <li key={item.id} role="listitem">
                      <button
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => onSelectConversation(item.id)}
                        className={mergeClasses(
                          'flex w-full flex-col gap-0.5 px-4 py-2.5 text-left',
                          styles.item,
                          isActive && styles.itemActive,
                        )}
                      >
                        <span className="truncate text-sm font-medium">
                          {item.title}
                        </span>
                        <span
                          className={mergeClasses('text-xs', styles.itemDate)}
                        >
                          {formatDate(item.updatedAt)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </>
    );
  },
);
