import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { getFileName } from '@/src/utils/app/file';

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
}

const initialState: ShareState = {
  status: UploadStatus.UNINITIALIZED,
  error: undefined,
  invitationId: undefined,
  shareResourceName: undefined,
  shareModalState: ModalState.CLOSED,
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
      state.shareResourceName = getFileName(payload.resourceId);
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

export const ShareSelectors = {
  selectInvitationId,
  selectShareModalState,
  selectShareModalClosed,
  selectShareResourceName,
};

export const ShareActions = shareSlice.actions;
