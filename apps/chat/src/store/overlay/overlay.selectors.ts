import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/src/types/store';

import { OverlayState } from './overlay.types';

const rootSelector = (state: RootState): OverlayState => state.overlay;

const selectHostDomain = createSelector([rootSelector], (state) => {
  return state.hostDomain;
});

const selectOverlaySystemPrompt = createSelector([rootSelector], (state) => {
  return state.systemPrompt;
});

const selectOptionsReceived = createSelector([rootSelector], (state) => {
  return state.optionsReceived;
});

const selectReadyToInteractSent = createSelector([rootSelector], (state) => {
  return state.readyToInteractSent;
});

export const OverlaySelectors = {
  selectHostDomain,
  selectOverlaySystemPrompt,
  selectOptionsReceived,
  selectReadyToInteractSent,
};
