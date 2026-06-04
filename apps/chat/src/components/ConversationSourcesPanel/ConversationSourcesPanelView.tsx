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

  if (!isOpen) return null;

  return <ConversationSourcesPanel messages={messages} />;
};

export default memo(ConversationSourcesPanelView);
