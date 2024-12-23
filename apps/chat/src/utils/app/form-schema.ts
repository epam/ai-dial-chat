import { FormButtonType } from '@/src/types/chat';

import { FormSchemaButtonOption } from '@epam/ai-dial-shared';

export const getFormButtonType = (option: FormSchemaButtonOption) => {
  if (option['dial:widgetOptions']?.submit) return FormButtonType.Submit;
  return FormButtonType.Populate;
};
