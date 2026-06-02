import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC, memo } from 'react';
import type { ConversationPanelProps } from '../../models/ConversationPanel.js';
import styles from './ConversationPanel.module.scss';

/** Collapsible left-side panel showing the user's conversation history. */
export const ConversationPanel: FC<ConversationPanelProps> = memo(
  ({
    conversations,
    isOpen,
    onSelectConversation,
    activeConversationId,
    title,
    emptyLabel,
    formatDate,
    colors,
    typography,
    className,
    onBackdropClick,
  }) => {
    const hasTypographyClass = Boolean(typography?.fontClassName);
    const cssVars = buildCssVars({
      '--ch-bg': colors?.background,
      '--ch-border': colors?.border,
      '--ch-header-border': colors?.headerBorder,
      '--ch-item-hover': colors?.itemHover,
      '--ch-item-active': colors?.itemActive,
      '--ch-text': colors?.text,
      '--ch-text-secondary': colors?.textSecondary,
      '--ch-title-font-family': hasTypographyClass
        ? undefined
        : typography?.fontFamily,
      '--ch-title-font-size': hasTypographyClass
        ? undefined
        : typography?.fontSize,
      '--ch-title-font-weight': hasTypographyClass
        ? undefined
        : typography?.fontWeight?.toString(),
      '--ch-title-line-height': hasTypographyClass
        ? undefined
        : typography?.lineHeight,
    });

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
          aria-hidden={!isOpen}
          style={cssVars}
          className={mergeClasses(
            'relative z-50 flex h-full min-w-0 flex-shrink-0 flex-col overflow-hidden',
            'transition-[width] duration-200 ease-in-out',
            isOpen ? 'w-[288px] border-l border-r' : 'w-[0px]',
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
            <span
              className={mergeClasses(
                'truncate px-2',
                styles.headerTitle,
                typography?.fontClassName,
              )}
            >
              {title}
            </span>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p
                className={mergeClasses(
                  'flex h-full items-center justify-center gap-2 px-4 py-6 text-center text-sm',
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
