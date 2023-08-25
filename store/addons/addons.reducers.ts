import { i18n } from 'next-i18next';

import { ErrorMessage } from '@/types/error';
import { OpenAIEntityAddon } from '@/types/openai';

import { RootState } from '../index';

import { errorsMessages } from '@/constants/errors';
import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

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
    getAddonsFail: (state, { payload }: PayloadAction<{ error: any }>) => {
      state.isLoading = false;
      state.error = {
        title: i18n?.t('Error fetching addons.'),
        code: payload.error.status || 'unknown',
        messageLines: payload.error.statusText
          ? [payload.error.statusText]
          : [i18n?.t(errorsMessages.generalServer)],
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

const rootSelector = (state: RootState) => state.addons;

export const selectAddonsIsLoading = createSelector([rootSelector], (state) => {
  return state.isLoading;
});
export const selectAddonsError = createSelector([rootSelector], (state) => {
  return state.error;
});
export const selectAddons = createSelector([rootSelector], (state) => {
  return state.addons;
});
export const selectAddonsMap = createSelector([rootSelector], (state) => {
  return state.addonsMap;
});
export const selectRecentAddonsIds = createSelector([rootSelector], (state) => {
  return state.recentAddonsIds;
});

export const {
  getAddons,
  getAddonsFail,
  getAddonsSuccess,
  initRecentAddons,
  updateRecentAddons,
} = addonsSlice.actions;
