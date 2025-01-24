import { memo, useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import {
  getMessageSchema,
  isFormSchemaValid,
} from '@/src/utils/app/form-schema';

import { Translation } from '@/src/types/translation';

import { ChatActions } from '@/src/store/chat/chat.reducer';
import { ChatSelectors } from '@/src/store/chat/chat.selectors';
import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { FormSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/FormSchema';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';

import {
  DialSchemaProperties,
  Message,
  MessageFormSchema,
  MessageFormValueType,
} from '@epam/ai-dial-shared';

interface AssistantSchemaViewProps {
  schema: MessageFormSchema;
}

const AssistantSchemaView = ({ schema }: AssistantSchemaViewProps) => {
  const dispatch = useAppDispatch();

  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );
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

  return (
    <div className="mt-2">
      <FormSchema
        schema={schema}
        onChange={handleChange}
        disabled={isPlayback}
        formValue={formValue}
        showSelected
      />
    </div>
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
  const { t } = useTranslation(Translation.Chat);

  const schema = getMessageSchema(message);

  if (!schema) return null;

  if (!isFormSchemaValid(schema))
    return (
      <div className="mt-2">
        <ErrorMessage error={t('Form schema is invalid') ?? ''} />
      </div>
    );

  if (
    !isLastMessage &&
    !message.content &&
    !message.custom_content?.attachments &&
    !message.custom_content?.stages
  )
    return (
      <div className="text-base italic text-primary">
        {t('Below you can see your action selection.')}
      </div>
    );

  if (!isLastMessage) return null;

  return <AssistantSchemaView schema={schema} />;
});
