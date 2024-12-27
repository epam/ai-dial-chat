import { memo, useCallback, useMemo } from 'react';

import { getMessageSchema } from '@/src/utils/app/form-schema';

import { ChatActions } from '@/src/store/chat/chat.reducer';
import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { FormSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/FormSchema';

import {
  Message,
  MessageFormSchema,
  MessageFormValueType,
} from '@epam/ai-dial-shared';

interface AssistantSchemaViewProps {
  schema: MessageFormSchema;
  isLastMessage: boolean;
}

const AssistantSchemaView = ({
  schema,
  isLastMessage,
}: AssistantSchemaViewProps) => {
  const dispatch = useAppDispatch();

  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );

  const descriptions = useMemo(() => {
    return Object.values(schema.properties)
      .map(({ description }) => description)
      .filter(Boolean);
  }, [schema]);

  const handleChange = useCallback(
    (property: string, value: MessageFormValueType, submit?: boolean) => {
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
    },
    [dispatch, schema],
  );

  if (!isLastMessage)
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

interface AssistantSchemaProps {
  message: Message;
  isLastMessage: boolean;
}

export const AssistantSchema = memo(function AssistantSchema({
  message,
  isLastMessage,
}: AssistantSchemaProps) {
  const schema = getMessageSchema(message);

  if (!schema) return null;

  return <AssistantSchemaView schema={schema} isLastMessage={isLastMessage} />;
});
