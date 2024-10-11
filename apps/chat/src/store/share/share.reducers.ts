import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { splitEntityId } from '@/src/utils/app/folders';
import { parseConversationApiKey } from '@/src/utils/server/api';

import { FeatureType } from '@/src/types/common';
import { ErrorMessage } from '@/src/types/error';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { ModalState } from '@/src/types/modal';
import { Prompt } from '@/src/types/prompt';
import { ShareRelations } from '@/src/types/share';

import { RootState } from '../index';

import { ConversationInfo, UploadStatus } from '@epam/ai-dial-shared';

export interface ShareState {
  status: UploadStatus;
  error: ErrorMessage | undefined;
  invitationId: string | undefined;
  shareResourceName: string | undefined;
  shareModalState: ModalState;
  acceptedId: string | undefined;
  isFolderAccepted: boolean | undefined;
  shareFeatureType?: FeatureType;
  shareIsFolder?: boolean;
  isConversation?: boolean;
  isPrompt?: boolean;
}

const initialState: ShareState = {
  status: UploadStatus.UNINITIALIZED,
  error: undefined,
  invitationId: undefined,
  shareResourceName: undefined,
  shareModalState: ModalState.CLOSED,
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
    share: (
      state,
      {
        payload,
      }: PayloadAction<{
        featureType: FeatureType;
        resourceId: string;
        isFolder?: boolean;
      }>,
    ) => {
      state.invitationId = undefined;
      state.shareModalState = ModalState.LOADING;
      state.shareFeatureType = payload.featureType;
      state.shareIsFolder = payload.isFolder;

      const name = splitEntityId(payload.resourceId).name;
      state.shareResourceName =
        payload.featureType === FeatureType.Chat
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
    shareFail: (state, _action: PayloadAction<string | undefined>) => {
      state.invitationId = undefined;
      state.shareModalState = ModalState.CLOSED;
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
      }>,
    ) => {
      state.acceptedId = payload.acceptedId;
      state.isFolderAccepted = payload.isFolder;
      state.isConversation = payload.isConversation;
      state.isPrompt = payload.isPrompt;
    },
    triggerGettingSharedConversationListings: (state) => state,
    triggerGettingSharedPromptListings: (state) => state,
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
        recursive?: boolean;
      }>,
    ) => state,
    getSharedListingSuccess: (
      state,
      _action: PayloadAction<{
        featureType: FeatureType;
        sharedWith: ShareRelations;
        resources: {
          entities: (ConversationInfo | Prompt | DialFile)[];
          folders: FolderInterface[];
        };
        recursive: boolean;
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
const selectShareFeatureType = createSelector([rootSelector], (state) => {
  return state.shareFeatureType;
});
const selectShareIsFolder = createSelector([rootSelector], (state) => {
  return state.shareIsFolder;
});
const selectAcceptedEntityInfo = createSelector([rootSelector], (state) => {
  return {
    acceptedId: state.acceptedId,
    isFolderAccepted: state.isFolderAccepted,
    isConversation: state.isConversation,
    isPrompt: state.isPrompt,
  };
});

export const ShareSelectors = {
  selectInvitationId,
  selectShareModalState,
  selectShareModalClosed,
  selectShareResourceName,
  selectAcceptedEntityInfo,
  selectShareFeatureType,
  selectShareIsFolder,
};

export const ShareActions = shareSlice.actions;
