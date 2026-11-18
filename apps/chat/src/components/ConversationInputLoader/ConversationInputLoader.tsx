import type { ConversationInputProps } from '@epam/ai-dial-conversation-input';
import { lazy, memo, useState, type FC } from 'react';
import {
  getLoadedConversationInput,
  loadConversationInput,
} from '../../utils/conversation-input-loader';

const LazyConversationInput = lazy(async () => {
  const module = await loadConversationInput();
  return { default: module.ConversationInput };
});

/*
 * `React.lazy` suspends on its first render even when the chunk is already in
 * memory, and a Suspense boundary that showed its fallback reveals the content
 * only after React's ~300 ms fallback throttle. On the home page that held the
 * greeting — the LCP element — behind the composer's boundary. When `app.tsx`'s
 * preload has finished, the input renders directly instead.
 *
 * The path is chosen once per instance: switching from the lazy component to
 * the loaded one on a later render would remount the input and drop its text.
 */
const ConversationInputLoader: FC<ConversationInputProps> = (props) => {
  const [LoadedInput] = useState(
    () => getLoadedConversationInput()?.ConversationInput,
  );

  return LoadedInput ? (
    <LoadedInput {...props} />
  ) : (
    <LazyConversationInput {...props} />
  );
};

export default memo(ConversationInputLoader);
