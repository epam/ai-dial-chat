import { FormButtonType } from '@/src/types/chat';

import { FormSchemaButtonOption, Message } from '@epam/ai-dial-shared';

export const getFormButtonType = (option: FormSchemaButtonOption) => {
  if (option['dial:widgetOptions']?.submit) return FormButtonType.Submit;
  return FormButtonType.Populate;
};

export const isMessageInputDisabled = (
  messageIndex: number,
  messages: Message[],
) => {
  const schema = messages[messageIndex - 1]?.custom_content?.form_schema;

  return !!schema?.['dial:chatMessageInputDisabled'];
};
