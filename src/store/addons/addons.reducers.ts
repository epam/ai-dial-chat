import { i18n } from 'next-i18next';

import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { ErrorMessage } from '@/src/types/error';
import { OpenAIEntityAddon } from '@/src/types/openai';

import { RootState } from '../index';

import { errorsMessages } from '@/src/constants/errors';

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
          : [i18n?.t(errorsMessages.generalServer, { ns: 'common' })],
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
const selectRecentAddonsIds = createSelector(
  [rootSelector, selectAddonsMap],
  ({ recentAddonsIds, addonsMap }) => {
    return recentAddonsIds.filter((id) => addonsMap[id]);
  },
);

export const AddonsSelectors = {
  selectAddonsIsLoading,
  selectAddonsError,
  selectAddons,
  selectAddonsMap,
  selectRecentAddonsIds,
};

export const AddonsActions = addonsSlice.actions;
