import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { translate } from '@/src/utils/app/translation';

import { ErrorMessage } from '@/src/types/error';
import { OpenAIEntityAddon } from '@/src/types/openai';

import { errorsMessages } from '@/src/constants/errors';

import { RootState } from '../index';

export interface AddonsState {
  isLoading: boolean;
  error: ErrorMessage | undefined;
  addons: OpenAIEntityAddon[];
  addonsMap: Partial<Record<string, OpenAIEntityAddon>>;
  recentAddonsIds: string[];
}

const initialState: AddonsState = {
  isLoading: false,
  error: undefined,
  addons: [],
  addonsMap: {},
  recentAddonsIds: [],
};

export const addonsSlice = createSlice({
  name: 'addons',
  initialState,
  reducers: {
    init: (state) => state,
    getAddons: (state) => {
      state.isLoading = true;
    },
    getAddonsSuccess: (
      state,
      { payload }: PayloadAction<{ addons: OpenAIEntityAddon[] }>,
    ) => {
      state.isLoading = false;
      state.error = undefined;
      state.addons = payload.addons;
      state.addonsMap = (payload.addons as OpenAIEntityAddon[]).reduce(
        (acc, model) => {
          acc[model.id] = model;

          return acc;
        },
        {} as Record<string, OpenAIEntityAddon>,
      );
    },
    getAddonsFail: (
      state,
      {
        payload,
      }: PayloadAction<{
        error: { status?: string | number; statusText?: string };
      }>,
    ) => {
      state.isLoading = false;
      state.error = {
        title: translate('Error fetching addons.'),
        code: payload.error.status || 'unknown',
        messageLines: payload.error.statusText
          ? [payload.error.statusText]
          : [translate(errorsMessages.generalServer, { ns: 'common' })],
      } as ErrorMessage;
    },
    initRecentAddons: (
      state,
      {
        payload,
      }: PayloadAction<{
        defaultRecentAddonsIds: string[];
        localStorageRecentAddonsIds: string[];
      }>,
    ) => {
      if (payload.localStorageRecentAddonsIds.length !== 0) {
        state.recentAddonsIds = payload.localStorageRecentAddonsIds;
      } else {
        state.recentAddonsIds = payload.defaultRecentAddonsIds;
      }
    },
    updateRecentAddons: (
      state,
      { payload }: PayloadAction<{ addonIds: string[] }>,
    ) => {
      const recentFilteredAddons = state.recentAddonsIds.filter(
        (id) => !payload.addonIds.includes(id),
      );
      const updatedAddonsIds = [...payload.addonIds, ...recentFilteredAddons];

      state.recentAddonsIds = updatedAddonsIds;
    },
  },
});

const rootSelector = (state: RootState): AddonsState => state.addons;

const selectAddonsIsLoading = createSelector([rootSelector], (state) => {
  return state.isLoading;
});
const selectAddonsError = createSelector([rootSelector], (state) => {
  return state.error;
});
const selectAddons = createSelector([rootSelector], (state) => {
  return state.addons;
});
const selectAddonsMap = createSelector([rootSelector], (state) => {
  return state.addonsMap;
});
const selectRecentAddonsIds = createSelector([rootSelector], (state) => {
  return state.recentAddonsIds;
});

export const AddonsSelectors = {
  selectAddonsIsLoading,
  selectAddonsError,
  selectAddons,
  selectAddonsMap,
  selectRecentAddonsIds,
};

export const AddonsActions = addonsSlice.actions;
