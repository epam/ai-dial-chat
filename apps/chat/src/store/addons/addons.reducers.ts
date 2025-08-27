import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { translate } from '@/src/utils/app/translation';

import { ErrorMessage } from '@/src/types/error';
import { AddonsMap, DialAIEntityAddon } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { errorsMessages } from '@/src/constants/errors';

import { AddonsState } from './addons.types';

const initialState: AddonsState = {
  initialized: false,
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
    initFinish: (state) => {
      state.initialized = true;
    },
    getAddons: (state) => {
      state.isLoading = true;
    },
    getAddonsSuccess: (
      state,
      { payload }: PayloadAction<{ addons: DialAIEntityAddon[] }>,
    ) => {
      state.isLoading = false;
      state.error = undefined;
      state.addons = payload.addons;
      state.addonsMap = (payload.addons as DialAIEntityAddon[]).reduce(
        (acc, model) => {
          acc[model.id] = model;

          return acc;
        },
        {} as AddonsMap,
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
        code: payload.error.status?.toString() ?? 'unknown',
        messageLines: payload.error.statusText
          ? [payload.error.statusText]
          : [
              translate(errorsMessages.generalServer, {
                ns: Translation.Common,
              }),
            ],
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

export const AddonsActions = addonsSlice.actions;
