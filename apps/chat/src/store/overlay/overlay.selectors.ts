import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/src/types/store';

import { MessageButton } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState) => state.overlay;

const selectHostDomain = (state: RootState) => rootSelector(state).hostDomain;

const selectOverlaySystemPrompt = (state: RootState) =>
  rootSelector(state).systemPrompt;

const selectOptionsReceived = (state: RootState) =>
  rootSelector(state).optionsReceived;

const selectReadyToInteractSent = (state: RootState) =>
  rootSelector(state).readyToInteractSent;

const selectCustomButtons = (state: RootState) =>
  rootSelector(state).customMessageButtons;

const selectCustomButtonsForMessage = createSelector(
  [selectCustomButtons, (_state, messageIndex: number) => messageIndex],
  (customButtons, messageIndex) => {
    return customButtons.find(
      (buttons) => buttons.messageIndex === messageIndex,
    )?.buttons as MessageButton[] | undefined;
  },
);

export const OverlaySelectors = {
  selectHostDomain,
  selectOverlaySystemPrompt,
  selectOptionsReceived,
  selectReadyToInteractSent,
  selectCustomButtons,
  selectCustomButtonsForMessage,
};
