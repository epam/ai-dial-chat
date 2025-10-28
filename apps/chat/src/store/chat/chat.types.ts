import { EntityInfo, EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';

import { MessageFormSchema, MessageFormValue } from '@epam/ai-dial-shared';

export interface ChatState {
  inputContent: string;
  formValue?: MessageFormValue;
  configurationSchemas: { modelId: string; schema: MessageFormSchema }[];
  configurationSchemasLoadingIds: string[];
  shouldFocusAndScroll?: boolean;
  notAvailableEntityType?: EntityType;
  infoModalState: ModalState;
  selectedEntityInfo?: EntityInfo;
}
