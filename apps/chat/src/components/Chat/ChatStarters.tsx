import { memo, useCallback, useMemo } from 'react';

import { removeDescriptionsFromSchema } from '@/src/utils/app/form-schema';

import { ChatActions } from '@/src/store/chat/chat.reducer';
import { ChatSelectors } from '@/src/store/chat/chat.selectors';
import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.selectors';

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

  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
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
      buttonsWrapperClassName="overflow-y-hidden justify-center"
      buttonClassName="shrink-0"
      wrapperClassName="lg:items-center"
      propertyWrapperClassName={
        isChatFullWidth ? 'mx-4 md:mx-20 lg:mx-auto' : 'max-w-screen-md'
      }
    />
  );
};

export const ChatStarters = memo(function ChatStarters() {
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );
  const schema = useAppSelector(ChatSelectors.selectConfigurationSchema);
  const isSchemaLoading = useAppSelector(
    ChatSelectors.selectIsConfigurationSchemaLoading,
  );

  if (
    selectedConversations.length > 1 ||
    selectedConversations[0]?.messages?.length > 0 ||
    isSchemaLoading ||
    !schema ||
    isReplay
  ) {
    return null;
  }

  return <ChatStartersView schema={schema} />;
});
