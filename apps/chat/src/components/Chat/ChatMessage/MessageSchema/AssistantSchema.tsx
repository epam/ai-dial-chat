import { memo, useCallback, useMemo } from 'react';

import { ChatActions } from '@/src/store/chat/chat.reducer';
import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { FormSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/FormSchema';

import { Message, MessageFormValueType } from '@epam/ai-dial-shared';

interface AssistantSchemaProps {
  message: Message;
  isLastMessage: boolean;
}

const _AssistantSchema = ({ message, isLastMessage }: AssistantSchemaProps) => {
  const dispatch = useAppDispatch();

  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );

  const schema = useMemo(() => message.custom_content?.form_schema, [message]);

  const descriptions = useMemo(() => {
    if (!schema) return [];

    return Object.values(schema.properties)
      .map(({ description }) => description)
      .filter(Boolean);
  }, [schema]);

  const handleChange = useCallback(
    (property: string, value: MessageFormValueType, submit?: boolean) => {
      if (schema) {
        const populateText = schema.properties[property]?.oneOf?.find(
          (option) => option.const === value,
        )?.['dial:widgetOptions']?.populateText;

        dispatch(
          ChatActions.setFormValue({
            property,
            content: populateText,
            value,
            submit,
          }),
        );
      }
    },
    [dispatch, schema],
  );

  if (!schema) return null;

  if (schema && !isLastMessage)
    return (
      <div className="flex flex-col gap-2">
        {descriptions.map((description) => (
          <p
            key={description}
            className="mt-2 border-t border-tertiary py-2 text-sm text-primary"
          >
            {description}
          </p>
        ))}
      </div>
    );

  return (
    <FormSchema schema={schema} onChange={handleChange} disabled={isPlayback} />
  );
};

_AssistantSchema.displayName = 'AssistantSchema';

export const AssistantSchema = memo(_AssistantSchema);
