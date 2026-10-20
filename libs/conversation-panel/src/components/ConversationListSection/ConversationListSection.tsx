import { FilterTab, mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC, memo, useCallback, useEffect, useId, useState } from 'react';
import { CONVERSATION_PANEL_CLASS } from '../../constants/public-class-names';
import type { ConversationListSectionProps } from '../../models/conversation-list-section';
import { ConversationRowVariant } from '../../types/conversation-row-variant';
import { ConversationList } from '../ConversationList/ConversationList';
import { ConversationListHeader } from '../ConversationListHeader/ConversationListHeader';

/** Header and list of conversations as one section, owning the search text, the filter and the expanded state. */
export const ConversationListSection: FC<ConversationListSectionProps> = memo(
  ({
    conversations,
    isLoading,
    onSelectConversation,
    activeConversationId,
    labels,
    requestedFilter,
    isFilterHidden = false,
    onFilterChange,
    hiddenSources,
    headerActions,
    getActions,
    onActionMenuOpen,
    onMoveConversation,
    styles,
    listClassName,
    className,
  }) => {
    const listId = useId();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isListExpanded, setIsListExpanded] = useState(true);
    const [activeFilter, setActiveFilter] = useState(FilterTab.All);

    useEffect(() => {
      if (requestedFilter == null) return;
      setActiveFilter(requestedFilter);
    }, [requestedFilter]);

    const handleFilterChange = useCallback(
      (tab: FilterTab) => {
        setActiveFilter(tab);
        onFilterChange?.(tab);
      },
      [onFilterChange],
    );

    /* Searching a collapsed list would filter rows nobody can see, so a search
       that opens or has text brings the list back. */
    const handleSearchChange = useCallback((query: string) => {
      setSearchQuery(query);
      if (query !== '') setIsListExpanded(true);
    }, []);

    const handleSearchOpenChange = useCallback((isOpen: boolean) => {
      setIsSearchOpen(isOpen);
      if (isOpen) setIsListExpanded(true);
    }, []);

    const handleToggleExpanded = useCallback(
      () => setIsListExpanded((isExpanded) => !isExpanded),
      [],
    );

    return (
      <section
        aria-label={labels.title}
        className={mergeClasses(
          'flex min-h-0 flex-1 flex-col px-1 pt-4',
          className,
          CONVERSATION_PANEL_CLASS.listSection,
        )}
      >
        <div className="px-3 pb-2">
          <ConversationListHeader
            labels={labels}
            isExpanded={isListExpanded}
            onToggleExpanded={handleToggleExpanded}
            controlsId={listId}
            searchQuery={searchQuery}
            isSearchOpen={isSearchOpen}
            onSearchChange={handleSearchChange}
            onSearchOpenChange={handleSearchOpenChange}
            activeFilter={activeFilter}
            onFilterChange={isFilterHidden ? undefined : handleFilterChange}
            hiddenSources={hiddenSources}
            actions={headerActions}
            styles={styles?.header}
          />
        </div>
        {/* Kept mounted while collapsed, so the list keeps its open groups and
            its scroll position. */}
        <div
          hidden={!isListExpanded}
          inert={!isListExpanded}
          className={isListExpanded ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
        >
          <ConversationList
            id={listId}
            conversations={conversations}
            isLoading={isLoading}
            onSelectConversation={onSelectConversation}
            activeConversationId={activeConversationId}
            labels={labels}
            searchQuery={searchQuery}
            activeFilter={activeFilter}
            hiddenSources={hiddenSources}
            rowVariant={ConversationRowVariant.Indicator}
            getActions={getActions}
            onActionMenuOpen={onActionMenuOpen}
            onMoveConversation={onMoveConversation}
            styles={styles?.list}
            className={listClassName}
          />
        </div>
      </section>
    );
  },
);
