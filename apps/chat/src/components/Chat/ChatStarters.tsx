import { memo, useCallback, useMemo } from 'react';

import classNames from 'classnames';

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

  const formValue = useAppSelector(ChatSelectors.selectChatFormValue);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);

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
      buttonsWrapperClassName="overflow-y-hidden md:px-4 px-2 lg:px-0"
      buttonClassName="shrink-0"
      wrapperClassName={classNames(!isChatFullWidth && 'lg:items-center')}
      propertyWrapperClassName={
        isChatFullWidth ? 'lg:ml-20 lg:mr-[84px]' : 'lg:w-[768px]'
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
