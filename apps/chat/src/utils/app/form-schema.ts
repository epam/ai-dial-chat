import { Conversation, FormButtonType } from '@/src/types/chat';

import { FormSchemaButtonOption, Message } from '@epam/ai-dial-shared';

export const getMessageSchema = (message?: Message) =>
  message?.custom_content?.form_schema;
export const getMessageFormValue = (message?: Message) =>
  message?.custom_content?.form_value;

export const getFormButtonType = (option: FormSchemaButtonOption) => {
  if (option['dial:widgetOptions']?.submit) return FormButtonType.Submit;
  return FormButtonType.Populate;
};

export const isMessageInputDisabled = (
  messageIndex: number,
  messages: Message[],
) => {
  const schema = getMessageSchema(messages[messageIndex - 1]);

  return !!schema?.['dial:chatMessageInputDisabled'];
};

export const isConversationWithFormSchema = (conversation: Conversation) => {
  return (
    conversation.messages?.some(
      (message) =>
        !!getMessageSchema(message) || !!getMessageFormValue(message),
    ) ?? false
  );
};
