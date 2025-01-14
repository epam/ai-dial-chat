import { FeatureType } from '@/src/types/common';
import { DialAIError } from '@/src/types/error';
import { DialAIEntityModel } from '@/src/types/models';
import { SharingType } from '@/src/types/share';

import { ShareEntity, SharePermission } from '@epam/ai-dial-shared';

export const getShareType = (
  featureType?: FeatureType,
  isFolder?: boolean,
): SharingType | undefined => {
  if (!featureType) {
    return undefined;
  }

  if (isFolder) {
    switch (featureType) {
      case FeatureType.Chat:
        return SharingType.ConversationFolder;
      case FeatureType.Prompt:
        return SharingType.PromptFolder;
      default:
        return undefined;
    }
  } else {
    switch (featureType) {
      case FeatureType.Chat:
        return SharingType.Conversation;
      case FeatureType.Prompt:
        return SharingType.Prompt;
      case FeatureType.Application:
        return SharingType.Application;
      default:
        return undefined;
    }
  }
};

export const validateInvitationId = (invitationId: string) => {
  // Validate invitationId to ensure it only contains alphanumeric characters and is of a reasonable length
  const isValidInvitationId = /^[A-Za-z0-9-]+$/.test(invitationId);
  if (!isValidInvitationId) {
    throw new DialAIError('Invalid invitationId', '', '', '400');
  }
};

export const hasWritePermission = (
  permissions: SharePermission[] | undefined,
) => permissions?.includes(SharePermission.WRITE);

export const canWriteSharedWithMe = (entity: DialAIEntityModel | ShareEntity) =>
  hasWritePermission(entity?.permissions);
