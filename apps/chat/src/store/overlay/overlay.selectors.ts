import { RootState } from '@/src/types/store';

const rootSelector = (state: RootState) => state.overlay;

const selectHostDomain = (state: RootState) => rootSelector(state).hostDomain;

const selectOverlaySystemPrompt = (state: RootState) =>
  rootSelector(state).systemPrompt;

const selectOptionsReceived = (state: RootState) =>
  rootSelector(state).optionsReceived;

const selectReadyToInteractSent = (state: RootState) =>
  rootSelector(state).readyToInteractSent;

export const OverlaySelectors = {
  selectHostDomain,
  selectOverlaySystemPrompt,
  selectOptionsReceived,
  selectReadyToInteractSent,
};
