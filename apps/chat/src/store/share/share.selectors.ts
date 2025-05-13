import { createSelector } from '@reduxjs/toolkit';

import { ModalState } from '@/src/types/modal';
import { RootState } from '@/src/types/store';

import { ShareState } from './share.types';

const rootSelector = (state: RootState): ShareState => state.share;

const selectInvitationId = (state: RootState) =>
  rootSelector(state).invitationId;

const selectWriteInvitationId = (state: RootState) =>
  rootSelector(state).writeInvitationId;

const selectShareModalState = (state: RootState) =>
  rootSelector(state).shareModalState;

const selectShareModalOpened = (state: RootState) =>
  rootSelector(state).shareModalState !== ModalState.CLOSED;

const selectShareResourceId = (state: RootState) =>
  rootSelector(state).shareResourceId;

const selectShareResourceName = (state: RootState) =>
  rootSelector(state).shareResourceName;

const selectShareFeatureType = (state: RootState) =>
  rootSelector(state).shareFeatureType;

const selectShareIsFolder = (state: RootState) =>
  rootSelector(state).shareIsFolder;

const selectAcceptedEntityInfo = createSelector([rootSelector], (state) => {
  return {
    acceptedId: state.acceptedId,
    isFolderAccepted: state.isFolderAccepted,
    isConversation: state.isConversation,
    isPrompt: state.isPrompt,
  };
});

const selectSharePermissions = (state: RootState) =>
  rootSelector(state).sharePermissions;

const selectUnshareModel = (state: RootState) =>
  rootSelector(state).unshareEntity;

const selectUnshareResourceId = (state: RootState) =>
  rootSelector(state).unshareResourceId;

const selectIsResourceShared = (state: RootState) =>
  rootSelector(state).isShared;

export const ShareSelectors = {
  selectInvitationId,
  selectWriteInvitationId,
  selectShareModalState,
  selectShareModalOpened,
  selectShareResourceId,
  selectShareResourceName,
  selectShareFeatureType,
  selectShareIsFolder,
  selectAcceptedEntityInfo,
  selectSharePermissions,
  selectUnshareModel,
  selectUnshareResourceId,
  selectIsResourceShared,
};
