import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { MappedReplaceActions, Operation } from '@/src/types/import-export';
import { Prompt } from '@/src/types/prompt';

import { UploadedAttachment } from '@/src/store/import-export/importExport.reducers';

import { UploadStatus } from '@epam/ai-dial-shared';

export interface ImportExportState {
  attachmentsIdsToUpload: string[];
  uploadedAttachments: UploadedAttachment[];
  ignoredAttachmentsIds?: string[];
  nonDuplicatedFiles: DialFile[];
  importedConversations: Conversation[];
  attachmentsErrors: string[];
  status?: UploadStatus;
  operation?: Operation;
  isPromptsBackedUp: boolean;
  isChatsBackedUp: boolean;
  duplicatedConversations?: Conversation[];
  duplicatedPrompts: Prompt[];
  duplicatedFiles: DialFile[];
  isShowReplaceDialog: boolean;
  featureType: FeatureType;
  mappedActions?: MappedReplaceActions;
}
