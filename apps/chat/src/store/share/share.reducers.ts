import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { splitEntityId } from '@/src/utils/app/folders';
import { hasWritePermission } from '@/src/utils/app/share';
import {
  parseApplicationApiKey,
  parseConversationApiKey,
} from '@/src/utils/server/api';

import { ApplicationInfo } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { ModalState } from '@/src/types/modal';
import { Prompt } from '@/src/types/prompt';
import { ShareRelations } from '@/src/types/share';

import * as ShareSelectors from './share.selectors';
import { ShareState } from './share.types';

import {
  ConversationInfo,
  ShareEntity,
  SharePermission,
  UploadStatus,
} from '@epam/ai-dial-shared';

export { ShareSelectors };
export type { ShareState };

const initialState: ShareState = {
  initialized: false,
  status: UploadStatus.UNINITIALIZED,
  error: undefined,
  invitationId: undefined,
  writeInvitationId: undefined,
  shareResourceName: undefined,
  shareResourceId: undefined,
  shareModalState: ModalState.CLOSED,
  unshareEntity: undefined,
  acceptedId: undefined,
  isFolderAccepted: undefined,
  shareFeatureType: undefined,
  shareIsFolder: undefined,
  isConversation: undefined,
  isPrompt: undefined,
};

export const shareSlice = createSlice({
  name: 'share',
  initialState,
  reducers: {
    init: (state) => state,
    initFinish: (state) => {
      state.initialized = true;
    },
    share: (
      state,
      {
        payload,
      }: PayloadAction<{
        featureType: FeatureType;
        resourceId: string;
        isFolder?: boolean;
        permissions?: SharePermission[];
      }>,
    ) => {
      state.invitationId = undefined;
      state.writeInvitationId = undefined;
      state.shareModalState = ModalState.LOADING;
      state.shareFeatureType = payload.featureType;
      state.shareIsFolder = payload.isFolder;
      state.shareResourceId = payload.resourceId;
      state.sharePermissions = payload.permissions;

      const name = splitEntityId(payload.resourceId).name;
      state.shareResourceName =
        payload.featureType === FeatureType.Chat
          ? parseConversationApiKey(splitEntityId(payload.resourceId).name).name
          : payload.featureType === FeatureType.Application
            ? parseApplicationApiKey(name).name
            : name;
    },
    sharePrompt: (
      state,
      _action: PayloadAction<{
        resourceId: string;
      }>,
    ) => state,
    sharePromptFolder: (
      state,
      _action: PayloadAction<{
        resourceId: string;
      }>,
    ) => state,
    shareConversation: (
      state,
      _action: PayloadAction<{
        resourceId: string;
      }>,
    ) => state,
    shareConversationFolder: (
      state,
      _action: PayloadAction<{
        resourceId: string;
      }>,
    ) => state,
    shareApplication: (
      state,
      {
        payload,
      }: PayloadAction<{
        resourceId: string;
        permissions?: SharePermission[];
      }>,
    ) => {
      state.shareModalState = ModalState.LOADING;
      state.sharePermissions = payload.permissions;
      state.shareResourceId = payload.resourceId;
    },
    shareSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        invitationId: string;
        permissions?: SharePermission[];
      }>,
    ) => {
      if (hasWritePermission(payload.permissions)) {
        state.writeInvitationId = payload.invitationId;
      } else {
        state.invitationId = payload.invitationId;
      }

      state.shareModalState = ModalState.OPENED;
      state.sharePermissions = undefined;
    },
    shareFail: (state, _action: PayloadAction<string | undefined>) => {
      state.invitationId = undefined;
      state.shareModalState = ModalState.CLOSED;
      state.sharePermissions = undefined;
    },

    revokeAccess: (
      state,
      _action: PayloadAction<{
        resourceId: string;
        featureType: FeatureType;
        isFolder?: boolean;
      }>,
    ) => state,
    revokeAccessSuccess: (
      state,
      _action: PayloadAction<{
        resourceId: string;
        featureType: FeatureType;
        isFolder?: boolean;
      }>,
    ) => state,
    revokeAccessFail: (state) => state,

    discardSharedWithMe: (
      state,
      _action: PayloadAction<{
        resourceIds: string[];
        featureType: FeatureType;
        isFolder?: boolean;
      }>,
    ) => state,
    discardSharedWithMeSuccess: (
      state,
      _action: PayloadAction<{
        resourceId: string;
        featureType: FeatureType;
        isFolder?: boolean;
      }>,
    ) => state,
    discardSharedWithMeFail: (state) => state,
    setModalState: (
      state,
      {
        payload,
      }: PayloadAction<{
        modalState: ModalState;
      }>,
    ) => {
      state.shareModalState = payload.modalState;
    },
    setUnshareEntity: (
      state,
      { payload }: PayloadAction<Omit<ShareEntity, 'folderId'> | undefined>,
    ) => {
      state.unshareEntity = payload;
    },
    acceptShareInvitation: (
      state,
      _action: PayloadAction<{
        invitationId: string;
      }>,
    ) => state,
    acceptShareInvitationSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        acceptedId: string;
        isFolder: boolean;
        isConversation?: boolean;
        isPrompt?: boolean;
        isApplication?: boolean;
      }>,
    ) => {
      state.acceptedId = payload.acceptedId;
      state.isFolderAccepted = payload.isFolder;
      state.isConversation = payload.isConversation;
      state.isPrompt = payload.isPrompt;
    },
    triggerGettingSharedConversationListings: (state) => state,
    triggerGettingSharedPromptListings: (state) => state,
    triggerGettingSharedFilesListings: (state) => state,
    triggerGettingSharedApplicationsListings: (state) => state,
    acceptShareInvitationFail: (
      state,
      _action: PayloadAction<{
        message?: string;
      }>,
    ) => state,
    resetAcceptedEntityInfo: (state) => {
      state.acceptedId = undefined;
      state.isFolderAccepted = undefined;
      state.isConversation = undefined;
      state.isPrompt = undefined;
    },
    getSharedListing: (
      state,
      _action: PayloadAction<{
        featureType: FeatureType;
        sharedWith: ShareRelations;
      }>,
    ) => state,
    getSharedListingSuccess: (
      state,
      _action: PayloadAction<{
        featureType: FeatureType;
        sharedWith: ShareRelations;
        resources: {
          entities: (
            | ConversationInfo
            | Prompt
            | DialFile
            | Omit<ApplicationInfo, 'folderId'>
          )[];
          folders: FolderInterface[];
        };
      }>,
    ) => state,
    getSharedListingFail: (state) => state,
  },
});

export const ShareActions = shareSlice.actions;
