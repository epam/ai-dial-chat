import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { memo, type FC } from 'react';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext.js';
import ConversationSourcesPanel from './ConversationSourcesPanel.js';

/**
 * Isolated context consumer for the right sidebar.
 * Rendered as a sibling of <main> in App so it spans full height.
 * Kept as a separate component so App itself does not subscribe to
 * SourcesSidebarContext and avoids re-rendering on every context change.
 */
const ConversationSourcesPanelView: FC = () => {
  const { isOpen, messages } = useSourcesSidebar();

  return (
    <div
      className={mergeClasses(
        'overflow-hidden transition-[width] duration-200 ease-in-out',
        isOpen ? 'w-[360px]' : 'w-0',
      )}
    >
      <ConversationSourcesPanel messages={messages} />
    </div>
  );
};

export default memo(ConversationSourcesPanelView);
