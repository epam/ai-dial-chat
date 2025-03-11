import { EntityInfo, EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';

import { MessageFormSchema, MessageFormValue } from '@epam/ai-dial-shared';

export interface ChatState {
  inputContent: string;
  formValue?: MessageFormValue;
  configurationSchema?: MessageFormSchema;
  isConfigurationSchemaLoading: boolean;
  shouldFocusAndScroll?: boolean;
  notAvailableEntityType?: EntityType;
  infoModalState: ModalState;
  selectedEntityInfo?: EntityInfo;
}
