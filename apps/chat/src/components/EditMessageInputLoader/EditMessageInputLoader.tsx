import type { EditMessageInputProps } from '@epam/ai-dial-conversation-input';
import { lazy, memo, useState, type FC } from 'react';
import {
  getLoadedConversationInput,
  loadConversationInput,
} from '../../utils/conversation-input-loader';

const LazyEditMessageInput = lazy(async () => {
  const module = await loadConversationInput();
  return { default: module.EditMessageInput };
});

/*
 * Renders the edit-message input directly once its chunk has loaded, so
 * opening an edit does not flash the Suspense fallback; see
 * `ConversationInputLoader`. The path is chosen once per instance so the
 * input never remounts mid-edit.
 */
const EditMessageInputLoader: FC<EditMessageInputProps> = (props) => {
  const [LoadedInput] = useState(
    () => getLoadedConversationInput()?.EditMessageInput,
  );

  return LoadedInput ? (
    <LoadedInput {...props} />
  ) : (
    <LazyEditMessageInput {...props} />
  );
};

export default memo(EditMessageInputLoader);
