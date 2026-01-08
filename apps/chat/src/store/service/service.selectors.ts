import { RootState } from '@/src/types/store';

const rootSelector = (state: RootState) => state.service;

const selectIsSuccessfullySent = (state: RootState) =>
  rootSelector(state).isSuccessfullySent;

export const ServiceSelectors = { selectIsSuccessfullySent };
