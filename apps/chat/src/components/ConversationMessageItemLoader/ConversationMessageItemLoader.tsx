import { lazy, memo, Suspense, useState, type FC } from 'react';
import {
  getLoadedConversationMessageItem,
  loadConversationMessageItem,
} from '../../utils/conversation-message-loader';
import type { ConversationMessageItemProps } from '../ConversationView/ConversationMessageItem';

const LazyConversationMessageItem = lazy(async () => {
  const module = await loadConversationMessageItem();
  return { default: module.default };
});

/*
 * Messages are the LCP element of a conversation page, and `React.lazy`
 * suspends on its first render even when the chunk is already in memory; a
 * Suspense boundary that showed its fallback reveals the content only after
 * React's ~300 ms fallback throttle. When `app.tsx`'s preload has finished,
 * the message renders directly instead.
 *
 * The path is chosen once per instance: switching from the lazy component to
 * the loaded one on a later render would remount the message and drop its
 * local state (an open edit, a copied mark).
 */
const ConversationMessageItemLoader: FC<ConversationMessageItemProps> = (
  props,
) => {
  const [LoadedItem] = useState(
    () => getLoadedConversationMessageItem()?.default,
  );

  return LoadedItem ? (
    <LoadedItem {...props} />
  ) : (
    <Suspense fallback={null}>
      <LazyConversationMessageItem {...props} />
    </Suspense>
  );
};

export default memo(ConversationMessageItemLoader);
