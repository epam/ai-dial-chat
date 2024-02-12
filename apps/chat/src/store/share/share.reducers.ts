import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { constructPath, getFileName } from '@/src/utils/app/file';
import { parseConversationApiKey } from '@/src/utils/server/api';

import { ConversationInfo } from '@/src/types/chat';
import {
  BackendDataEntity,
  BackendDataNodeType,
  BackendResourceType,
  UploadStatus,
} from '@/src/types/common';
import { ErrorMessage } from '@/src/types/error';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { ModalState } from '@/src/types/modal';
import { ShareRelations } from '@/src/types/share';

import { RootState } from '../index';

export interface ShareState {
  status: UploadStatus;
  error: ErrorMessage | undefined;
  invitationId: string | undefined;
  shareResourceName: string | undefined;
  shareModalState: ModalState;

  sharedByMeFiles: BackendDataEntity[];
  sharedByMeConversations: BackendDataEntity[];
  sharedByMePrompts: BackendDataEntity[];

  sharedWithMeFiles: BackendDataEntity[];
  sharedWithMeConversations: BackendDataEntity[];
  sharedWithMePrompts: BackendDataEntity[];
}

const initialState: ShareState = {
  status: UploadStatus.UNINITIALIZED,
  error: undefined,
  invitationId: undefined,
  shareResourceName: undefined,
  shareModalState: ModalState.CLOSED,

  sharedByMeFiles: [],
  sharedByMeConversations: [],
  sharedByMePrompts: [],

  sharedWithMeFiles: [],
  sharedWithMeConversations: [],
  sharedWithMePrompts: [],
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
        nodeType: BackendDataNodeType;
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
    acceptShareInvitation: (
      state,
      _action: PayloadAction<{
        invitationId: string;
      }>,
    ) => state,
    acceptShareInvitationSuccess: (state) => state,
    acceptShareInvitationFail: (state) => state,
    getSharedListing: (
      state,
      _action: PayloadAction<{
        resourceTypes: BackendResourceType[];
        sharedWith: ShareRelations;
      }>,
    ) => state,
    getSharedListingSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        resourceTypes: BackendResourceType[];
        sharedWith: ShareRelations;
        resources: BackendDataEntity[];
      }>,
    ) => {
      if (payload.resourceTypes.includes(BackendResourceType.CONVERSATION)) {
        state[
          payload.sharedWith === ShareRelations.others
            ? 'sharedByMeConversations'
            : 'sharedWithMeConversations'
        ] = payload.resources.filter(
          (resource) =>
            resource.resourceType === BackendResourceType.CONVERSATION,
        );
      }
      if (payload.resourceTypes.includes(BackendResourceType.PROMPT)) {
        state[
          payload.sharedWith === ShareRelations.others
            ? 'sharedByMePrompts'
            : 'sharedWithMePrompts'
        ] = payload.resources.filter(
          (resource) => resource.resourceType === BackendResourceType.PROMPT,
        );
      }
      if (payload.resourceTypes.includes(BackendResourceType.FILE)) {
        state[
          payload.sharedWith === ShareRelations.others
            ? 'sharedByMeFiles'
            : 'sharedWithMeFiles'
        ] = payload.resources.filter(
          (resource) => resource.resourceType === BackendResourceType.FILE,
        );
      }
    },
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
const selectSharedByMeConversationsResources = createSelector(
  [rootSelector],
  (state) => {
    return state.sharedByMeConversations;
  },
);
const selectSharedByMePromptsResources = createSelector(
  [rootSelector],
  (state) => {
    return state.sharedByMePrompts;
  },
);
const selectSharedWithMeConversationsResources = createSelector(
  [rootSelector],
  (state) => {
    return state.sharedWithMeConversations;
  },
);
const selectSharedWithMePromptsResources = createSelector(
  [rootSelector],
  (state) => {
    return state.sharedWithMePrompts;
  },
);

const selectSharedWithMeConversationInfos = createSelector(
  [selectSharedWithMeConversationsResources],
  (sharedByMeConversations): ConversationInfo[] => {
    return sharedByMeConversations
      .filter((item) => item.nodeType === BackendDataNodeType.ITEM)
      .map((sharedEntity) => {
        const relativePath = sharedEntity.parentPath || undefined;
        const info = parseConversationApiKey(sharedEntity.name);

        return {
          ...info,
          id: constructPath(
            sharedEntity.bucket,
            sharedEntity.parentPath,
            sharedEntity.name,
          ),
          lastActivityDate: Date.now(),
          folderId: relativePath,

          sharedWithMe: true,
        };
      });
  },
);
const selectSharedWithMeConversationFolders = createSelector(
  [selectSharedWithMeConversationsResources],
  (sharedByMeConversations): FolderInterface[] => {
    return sharedByMeConversations
      .filter((item) => item.nodeType === BackendDataNodeType.FOLDER)
      .map((sharedEntity): FolderInterface => {
        const relativePath = sharedEntity.parentPath || undefined;
        const info = parseConversationApiKey(sharedEntity.name);

        return {
          ...info,
          id: constructPath(
            sharedEntity.bucket,
            sharedEntity.parentPath,
            sharedEntity.name,
          ),
          folderId: relativePath,
          type: FolderType.Chat,
          sharedWithMe: true,
        };
      });
  },
);

export const ShareSelectors = {
  selectInvitationId,
  selectShareModalState,
  selectShareModalClosed,
  selectShareResourceName,

  selectSharedByMeConversationsResources,

  selectSharedWithMeConversationInfos,
  selectSharedWithMeConversationFolders,

  selectSharedWithMePromptsResources,
  selectSharedByMePromptsResources,
};

export const ShareActions = shareSlice.actions;
