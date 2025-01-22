import { FeatureType } from '@/src/types/common';
import { ErrorMessage } from '@/src/types/error';
import { ModalState } from '@/src/types/modal';

import { SharePermission, UploadStatus } from '@epam/ai-dial-shared';

export interface ShareState {
  initialized: boolean;
  status: UploadStatus;
  error: ErrorMessage | undefined;
  invitationId: string | undefined;
  writeInvitationId: string | undefined;
  shareResourceName: string | undefined;
  shareResourceVersion: string | undefined;
  shareResourceId: string | undefined;
  shareModalState: ModalState;
  acceptedId: string | undefined;
  isFolderAccepted: boolean | undefined;
  shareFeatureType?: FeatureType;
  shareIsFolder?: boolean;
  isConversation?: boolean;
  isPrompt?: boolean;
  sharePermissions?: SharePermission[];
}
