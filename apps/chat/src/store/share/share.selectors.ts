import { createSelector } from '@reduxjs/toolkit';

import { ModalState } from '@/src/types/modal';

import { RootState } from '..';
import { ShareState } from './share.types';

const rootSelector = (state: RootState): ShareState => state.share;

export const selectInvitationId = createSelector([rootSelector], (state) => {
  return state.invitationId;
});

export const selectWriteInvitationId = createSelector(
  [rootSelector],
  (state) => {
    return state.writeInvitationId;
  },
);

export const selectShareModalState = createSelector([rootSelector], (state) => {
  return state.shareModalState;
});
export const selectShareModalClosed = createSelector(
  [rootSelector],
  (state) => {
    return state.shareModalState === ModalState.CLOSED;
  },
);

export const selectShareResourceId = createSelector([rootSelector], (state) => {
  return state.shareResourceId;
});

export const selectShareResourceName = createSelector(
  [rootSelector],
  (state) => {
    return state.shareResourceName;
  },
);

export const selectShareFeatureType = createSelector(
  [rootSelector],
  (state) => {
    return state.shareFeatureType;
  },
);
export const selectShareIsFolder = createSelector([rootSelector], (state) => {
  return state.shareIsFolder;
});
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
export const selectInitialized = createSelector(
  [rootSelector],
  (state) => state.initialized,
);
export const selectSharePermissions = createSelector(
  [rootSelector],
  (state) => state.sharePermissions,
);
export const selectUnshareModel = createSelector([rootSelector], (state) => {
  return state.unshareEntity;
});
