import { createSelector } from '@reduxjs/toolkit';

import { ModalState } from '@/src/types/modal';
import { RootState } from '@/src/types/store';

import { ShareState } from './share.types';

const rootSelector = (state: RootState): ShareState => state.share;

export const selectInvitationId = (state: RootState) =>
  rootSelector(state).invitationId;

export const selectWriteInvitationId = (state: RootState) =>
  rootSelector(state).writeInvitationId;

export const selectShareModalState = (state: RootState) =>
  rootSelector(state).shareModalState;

export const selectShareModalOpened = (state: RootState) =>
  rootSelector(state).shareModalState !== ModalState.CLOSED;

export const selectShareResourceId = (state: RootState) =>
  rootSelector(state).shareResourceId;

export const selectShareResourceName = (state: RootState) =>
  rootSelector(state).shareResourceName;

export const selectShareFeatureType = (state: RootState) =>
  rootSelector(state).shareFeatureType;

export const selectShareIsFolder = (state: RootState) =>
  rootSelector(state).shareIsFolder;

export const selectAcceptedEntityInfo = createSelector(
  [rootSelector],
  (state) => {
    return {
      acceptedId: state.acceptedId,
      isFolderAccepted: state.isFolderAccepted,
      isConversation: state.isConversation,
      isPrompt: state.isPrompt,
    };
  },
);

export const selectInitialized = (state: RootState) =>
  rootSelector(state).initialized;

export const selectSharePermissions = (state: RootState) =>
  rootSelector(state).sharePermissions;

export const selectUnshareModel = (state: RootState) =>
  rootSelector(state).unshareEntity;
