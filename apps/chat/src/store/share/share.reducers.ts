import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { getFileName } from '@/src/utils/app/file';
import { ApiKeys } from '@/src/utils/server/api';

import {
  BackendDataEntity,
  BackendResourceType,
  UploadStatus,
} from '@/src/types/common';
import { ErrorMessage } from '@/src/types/error';
import { ModalState } from '@/src/types/modal';

import { RootState } from '../index';

export type ShareState = {
  [resource in ApiKeys]: BackendDataEntity[];
} & {
  status: UploadStatus;
  error: ErrorMessage | undefined;
  invitationId: string | undefined;
  shareResourceName: string | undefined;
  shareModalState: ModalState;
};

const initialState: ShareState = {
  status: UploadStatus.UNINITIALIZED,
  error: undefined,
  invitationId: undefined,
  shareResourceName: undefined,
  shareModalState: ModalState.CLOSED,

  files: [],
  conversations: [],
  prompts: [],
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
        resourceRelativePath: string;
      }>,
    ) => {
      state.invitationId = undefined;
      state.shareModalState = ModalState.LOADING;
      state.shareResourceName = getFileName(payload.resourceRelativePath);
    },
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
    getSharedByMe: (state) => state,
    getSharedWithMe: (state) => state,
    acceptShareInvitation: (
      state,
      _action: PayloadAction<{
        invitationId: string;
      }>,
    ) => state,
    acceptShareInvitationSuccess: (state) => state,
    acceptShareInvitationFail: (state) => state,
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
