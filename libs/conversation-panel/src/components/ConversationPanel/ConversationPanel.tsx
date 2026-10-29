import {
  buildCssVars,
  FilterTab,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { SidebarOrientation, SidebarPanel } from '@epam/ai-dial-sidebar';
import { Search } from '@epam/ai-dial-ui-kit';
import {
  type FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { CONVERSATION_PANEL_CLASS } from '../../constants/public-class-names';
import type {
  ConversationListLabels,
  ConversationListStyles,
} from '../../models/conversation-list';
import { ConversationPanelProps } from '../../models/panel-props';
import { ConversationList } from '../ConversationList/ConversationList';
import { FilterTabs } from '../FilterTabs/FilterTabs';
import { NewChatButton } from '../NewChatButton/NewChatButton';
import styles from './ConversationPanel.module.scss';

/** Collapsible side panel showing the user's conversation history. */
export const ConversationPanel: FC<ConversationPanelProps> = memo(
  ({
    conversations,
    isLoading,
    isUpdatingTitles,
    preserveActiveSearchResult,
    isOpen,
    onSelectConversation,
    activeConversationId,
    labels,
    onNewChat,
    styles: panelStyles,
    className,
    isOverlay = false,
    getActions,
    onActionMenuOpen,
    onToggle,
    headerActions,
    onMoveConversation,
    onVisibleConversationIdsChange,
    activeFilter,
    onActiveFilterChange,
    isFilterTabsHidden = false,
    hiddenSources,
  }) => {
    const {
      colors,
      typography,
      newChatButton: newChatButtonColors,
      searchWrapperClassName,
      headerClassName,
      headerActionsClassName,
      newChatButtonClassName,
    } = panelStyles ?? {};

    const {
      title,
      emptyLabel,
      emptyDescription,
      noResultsLabel,
      noResultsDescription,
      sharedEmptyDescription,
      tabEmptyLabels,
      loadingLabel,
      updatingTitlesLabel,
      newChatLabel,
      searchPlaceholder,
      searchClearLabel,
      filterLabels,
      groupLabels,
      actionsLabel,
      unreadIndicatorLabel,
      closeAriaLabel,
    } = labels;
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState(FilterTab.All);

    useEffect(() => {
      if (activeFilter == null) return;
      setActiveTab(activeFilter);
    }, [activeFilter]);

    const handleSearchChange = useCallback((value?: string) => {
      setSearchQuery(value ?? '');
    }, []);

    /* Only what the panel's own chrome reads; the list sets the rest from the
       `colors` forwarded to it. */
    const cssVars = buildCssVars({
      '--cp-text': colors?.text,
      '--cp-new-chat-bg': newChatButtonColors?.background,
      '--cp-new-chat-text': newChatButtonColors?.text,
      '--cp-new-chat-focus-outline': newChatButtonColors?.focusOutline,
    });

    /* Stable, so `memo(ConversationList)` is not defeated by a fresh object
       on every panel render. */
    const listLabels = useMemo<ConversationListLabels>(
      () => ({
        emptyLabel,
        emptyDescription,
        noResultsLabel,
        noResultsDescription,
        sharedEmptyDescription,
        tabEmptyLabels,
        loadingLabel,
        updatingTitlesLabel,
        groupLabels,
        actionsLabel,
        unreadIndicatorLabel,
      }),
      [
        emptyLabel,
        emptyDescription,
        noResultsLabel,
        noResultsDescription,
        sharedEmptyDescription,
        tabEmptyLabels,
        loadingLabel,
        updatingTitlesLabel,
        groupLabels,
        actionsLabel,
        unreadIndicatorLabel,
      ],
    );

    const listStyles = useMemo<ConversationListStyles>(
      () => ({
        colors,
        typography: {
          fontFamily: typography?.fontFamily,
          groupHeaderClassName: typography?.groupHeaderClassName,
          itemTitleClassName: typography?.itemTitleClassName,
        },
        itemIconBadgeClassName: panelStyles?.itemIconBadgeClassName,
      }),
      [
        colors,
        typography?.fontFamily,
        typography?.groupHeaderClassName,
        typography?.itemTitleClassName,
        panelStyles?.itemIconBadgeClassName,
      ],
    );

    return (
      <SidebarPanel
        isOpen={isOpen}
        isOverlay={isOverlay}
        orientation={SidebarOrientation.Left}
        title={title}
        labels={{ ariaLabel: title, closeLabel: closeAriaLabel }}
        onClose={onToggle}
        styles={{
          colors: {
            background: colors?.background,
            border: colors?.border,
          },
          typography: {
            fontClassName: typography?.fontClassName,
          },
          bodyClassName: 'flex flex-col overflow-hidden p-0 gap-3',
          cssVars,
          titleClassName: typography?.fontClassName,
          headerClassName: mergeClasses('h-[64px]', headerClassName),
          headerActionsClassName,
          className: mergeClasses(
            isOpen ? 'w-[324px] mobile:w-full' : 'w-0',
            className,
          ),
        }}
        rightActions={headerActions}
      >
        <NewChatButton
          label={newChatLabel}
          onClick={onNewChat}
          labelClassName={typography?.newChatLabelClassName}
          colors={newChatButtonColors}
          className={newChatButtonClassName}
        />

        <div
          role="search"
          className={mergeClasses('px-3 py-2', CONVERSATION_PANEL_CLASS.search)}
        >
          <Search
            wrapperClassName={mergeClasses(
              styles.search,
              searchWrapperClassName,
            )}
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
            clearLabel={searchClearLabel}
            aria-label={searchPlaceholder}
          />
        </div>

        {!isFilterTabsHidden && (
          <FilterTabs
            activeTab={activeTab}
            labels={filterLabels}
            onChange={(tab) => {
              setActiveTab(tab);
              onActiveFilterChange?.(tab);
            }}
            tabClassName={typography?.tabClassName}
            hiddenSources={hiddenSources}
          />
        )}

        <ConversationList
          conversations={conversations}
          isLoading={isLoading}
          isUpdatingTitles={isUpdatingTitles}
          preserveActiveSearchResult={preserveActiveSearchResult}
          onSelectConversation={onSelectConversation}
          activeConversationId={activeConversationId}
          labels={listLabels}
          searchQuery={searchQuery}
          activeFilter={activeTab}
          hiddenSources={hiddenSources}
          getActions={getActions}
          onActionMenuOpen={onActionMenuOpen}
          onMoveConversation={onMoveConversation}
          onVisibleConversationIdsChange={onVisibleConversationIdsChange}
          styles={listStyles}
        />
      </SidebarPanel>
    );
  },
);
