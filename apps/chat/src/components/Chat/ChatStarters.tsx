import { memo, useCallback, useMemo } from 'react';

import { removeDescriptionsFromSchema } from '@/src/utils/app/form-schema';

import { ChatActions } from '@/src/store/chat/chat.reducer';
import { ChatSelectors } from '@/src/store/chat/chat.selectors';
import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { FormSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/FormSchema';

import {
  DialSchemaProperties,
  MessageFormSchema,
  MessageFormValueType,
} from '@epam/ai-dial-shared';

interface ChatStartersViewProps {
  schema: MessageFormSchema;
}

const ChatStartersView = ({ schema }: ChatStartersViewProps) => {
  const dispatch = useAppDispatch();

  const formValue = useAppSelector(ChatSelectors.selectChatFormValue);

  const handleChange = useCallback(
    (property: string, value: MessageFormValueType, submit?: boolean) => {
      const populateText = schema.properties[property]?.oneOf?.find(
        (option) => option.const === value,
      )?.[DialSchemaProperties.DialWidgetOptions]?.populateText;

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

  const schemaWithoutDescription = useMemo(
    () => removeDescriptionsFromSchema(schema),
    [schema],
  );

  return (
    <FormSchema
      schema={schemaWithoutDescription}
      formValue={formValue}
      showSelected
      onChange={handleChange}
      buttonsWrapperClassName="md:justify-center flex-nowrap overflow-scroll px-2"
      buttonClassName="shrink-0"
      propertyWrapperClassName="items-center"
    />
  );
};

export const ChatStarters = memo(function ChatStarters() {
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const schema = useAppSelector(ChatSelectors.selectConfigurationSchema);
  const isSchemaLoading = useAppSelector(
    ChatSelectors.selectIsConfigurationSchemaLoading,
  );

  if (
    selectedConversations.length > 1 ||
    selectedConversations[0]?.messages?.length > 0 ||
    isSchemaLoading ||
    !schema
  )
    return null;

  return <ChatStartersView schema={schema} />;
});
