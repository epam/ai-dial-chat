import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { splitEntityId } from '@/src/utils/app/folders';
import { parseConversationApiKey } from '@/src/utils/server/api';

import { ConversationInfo } from '@/src/types/chat';
import {
  BackendDataNodeType,
  BackendResourceType,
  UploadStatus,
} from '@/src/types/common';
import { ErrorMessage } from '@/src/types/error';
import { FolderInterface } from '@/src/types/folder';
import { ModalState } from '@/src/types/modal';
import { Prompt } from '@/src/types/prompt';
import { ShareRelations } from '@/src/types/share';

import { RootState } from '../index';

export interface ShareState {
  status: UploadStatus;
  error: ErrorMessage | undefined;
  invitationId: string | undefined;
  shareResourceName: string | undefined;
  shareModalState: ModalState;
  shareResourceType: BackendResourceType | undefined;
  shareNodeType: BackendDataNodeType | undefined;
}

const initialState: ShareState = {
  status: UploadStatus.UNINITIALIZED,
  error: undefined,
  invitationId: undefined,
  shareResourceName: undefined,
  shareModalState: ModalState.CLOSED,
  shareResourceType: undefined,
  shareNodeType: undefined,
};

export const shareSlice = createSlice({
  name: 'share',
  initialState,
  reducers: {
    init: (state) => state,
    share: (
      state,
      {
        payload,
      }: PayloadAction<{
        resourceType: BackendResourceType;
        resourceId: string;
        nodeType: BackendDataNodeType;
      }>,
    ) => {
      state.invitationId = undefined;
      state.shareModalState = ModalState.LOADING;
      state.shareResourceType = payload.resourceType;
      state.shareNodeType = payload.nodeType;

      const name = splitEntityId(payload.resourceId).name;
      state.shareResourceName =
        payload.resourceType === BackendResourceType.CONVERSATION
          ? parseConversationApiKey(splitEntityId(payload.resourceId).name).name
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
    shareSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        invitationId: string;
      }>,
    ) => {
      state.invitationId = payload.invitationId;
      state.shareModalState = ModalState.OPENED;
    },
    shareFail: (state) => {
      state.invitationId = undefined;
      state.shareModalState = ModalState.CLOSED;
    },

    revokeAccess: (
      state,
      _action: PayloadAction<{
        resourceId: string;
        resourceType: BackendResourceType;
        nodeType: BackendDataNodeType;
      }>,
    ) => state,
    revokeAccessSuccess: (
      state,
      _action: PayloadAction<{
        resourceId: string;
        resourceType: BackendResourceType;
        nodeType: BackendDataNodeType;
      }>,
    ) => state,
    revokeAccessFail: (state) => state,

    discardSharedWithMe: (
      state,
      _action: PayloadAction<{
        resourceId: string;
        resourceType: BackendResourceType;
        nodeType: BackendDataNodeType;
      }>,
    ) => state,
    discardSharedWithMeSuccess: (
      state,
      _action: PayloadAction<{
        resourceId: string;
        resourceType: BackendResourceType;
        nodeType: BackendDataNodeType;
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
    acceptShareInvitation: (
      state,
      _action: PayloadAction<{
        invitationId: string;
      }>,
    ) => state,
    acceptShareInvitationSuccess: (state) => state,
    acceptShareInvitationFail: (
      state,
      _action: PayloadAction<{
        message?: string;
      }>,
    ) => state,
    getSharedListing: (
      state,
      _action: PayloadAction<{
        resourceType: BackendResourceType;
        sharedWith: ShareRelations;
      }>,
    ) => state,
    getSharedListingSuccess: (
      state,
      _action: PayloadAction<{
        resourceType: BackendResourceType;
        sharedWith: ShareRelations;
        resources: {
          entities: (ConversationInfo | Prompt)[];
          folders: FolderInterface[];
        };
      }>,
    ) => state,
    getSharedListingFail: (state) => state,
  },
});

const rootSelector = (state: RootState): ShareState => state.share;

const selectInvitationId = createSelector([rootSelector], (state) => {
  return state.invitationId;
});
const selectShareModalState = createSelector([rootSelector], (state) => {
  return state.shareModalState;
});
const selectShareModalClosed = createSelector([rootSelector], (state) => {
  return state.shareModalState === ModalState.CLOSED;
});
const selectShareResourceName = createSelector([rootSelector], (state) => {
  return state.shareResourceName;
});
const selectShareResourceType = createSelector([rootSelector], (state) => {
  return state.shareResourceType;
});
const selectShareNodeType = createSelector([rootSelector], (state) => {
  return state.shareNodeType;
});

export const ShareSelectors = {
  selectInvitationId,
  selectShareModalState,
  selectShareModalClosed,
  selectShareResourceName,
  selectShareResourceType,
  selectShareNodeType,
};

export const ShareActions = shareSlice.actions;
