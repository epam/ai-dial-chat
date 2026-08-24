import { FeatureType } from '@/src/types/common';
import { ErrorMessage } from '@/src/types/error';
import { ModalState } from '@/src/types/modal';

import {
  ShareEntity,
  SharePermission,
  UploadStatus,
} from '@epam/ai-dial-shared';

export interface UnshareFileManagerItem {
  path: string;
  nodeType?: string;
  sharedWithMe?: boolean;
  isShared?: boolean;
}

export type UnshareEntity = Omit<ShareEntity, 'folderId'> & {
  displayName?: string;
};

export interface ShareState {
  status: UploadStatus;
  error: ErrorMessage | undefined;
  invitationId: string | undefined;
  writeInvitationId: string | undefined;
  shareResourceName: string | undefined;
  shareResourceDisplayName: string | undefined;
  shareResourceId: string | undefined;
  shareModalState: ModalState;
  unshareEntity?: UnshareEntity;
  acceptedId: string | undefined;
  isFolderAccepted: boolean | undefined;
  shareFeatureType?: FeatureType;
  shareIsFolder?: boolean;
  isConversation?: boolean;
  isPrompt?: boolean;
  sharePermissions?: SharePermission[];
  unshareResourceId?: string;
  isShared?: boolean;
  unshareFileManagerItems?: UnshareFileManagerItem[];
}
