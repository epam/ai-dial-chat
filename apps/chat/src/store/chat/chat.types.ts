import { EntityInfo, EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';

import { MessageFormSchema, MessageFormValue } from '@epam/ai-dial-shared';

export interface TextSelection {
  start: number;
  end: number;
}

export interface AsrInsertionContext {
  inputSnapshot: string;
  selection: TextSelection;
}

export interface ChatState {
  inputContent: string;
  inputContentTemplateMapping?: { substituted: string; original: string };
  userMessageTranscript?: string;
  userMessageVoiceAttachmentId?: string;
  formValue?: MessageFormValue;
  configurationSchemas: { modelId: string; schema: MessageFormSchema }[];
  configurationSchemasLoadingIds: string[];
  shouldFocusAndScroll?: boolean;
  notAvailableEntityType?: EntityType;
  infoModalState: ModalState;
  selectedEntityInfo?: EntityInfo;
  isTranscribing: boolean;
  isUserMessageTranscribing: boolean;
  isAsrFlowActive: boolean;
  asrInsertionContext?: AsrInsertionContext;
}
