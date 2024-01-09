import { Action, Store, configureStore } from '@reduxjs/toolkit';

import {
  Epic,
  EpicMiddleware,
  combineEpics,
  createEpicMiddleware,
} from 'redux-observable';

import { AddonsEpics } from './addons/addons.epics';
import { addonsSlice } from './addons/addons.reducers';
import { ConversationsEpics } from './conversations/conversations.epics';
import { conversationsSlice } from './conversations/conversations.reducers';
import { FilesEpics } from './files/files.epics';
import { filesSlice } from './files/files.reducers';
import { ModelsEpics } from './models/models.epics';
import { modelsSlice } from './models/models.reducers';
import { OverlayEpics } from './overlay/overlay.epics';
import { overlaySlice } from './overlay/overlay.reducers';
import { PromptsEpics } from './prompts/prompts.epics';
import { promptsSlice } from './prompts/prompts.reducers';
import { SettingsEpics } from './settings/settings.epic';
import { SettingsState, settingsSlice } from './settings/settings.reducers';
import UIEpics from './ui/ui.epics';
import { uiSlice } from './ui/ui.reducers';

export const rootEpic = combineEpics(
  ModelsEpics,
  AddonsEpics,
  UIEpics,
  PromptsEpics,
  ConversationsEpics,
  OverlayEpics,
  SettingsEpics,
  FilesEpics,
);

const reducer = {
  models: modelsSlice.reducer,
  addons: addonsSlice.reducer,
  ui: uiSlice.reducer,
  conversations: conversationsSlice.reducer,
  prompts: promptsSlice.reducer,
  settings: settingsSlice.reducer,
  overlay: overlaySlice.reducer,
  files: filesSlice.reducer,
};
const getMiddleware = (
  epicMiddleware: EpicMiddleware<Action<any>, Action<any>, void, any>,
) => {
  return (getDefaultMiddleware: any) => {
    return getDefaultMiddleware({
      thunk: false,
      serializableCheck: false,
    }).concat(epicMiddleware);
  };
};
let store: Store;
export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const createStore = (preloadedState: { settings: SettingsState }) => {
  if (typeof window === 'undefined') {
    const epicMiddleware = createEpicMiddleware();

    const middleware = getMiddleware(epicMiddleware);
    const localStore = configureStore({
      reducer,
      preloadedState,
      middleware,
    });
    epicMiddleware.run(rootEpic as unknown as Epic);

    return localStore;
  }

  if (!store) {
    const epicMiddleware = createEpicMiddleware();

    const middleware = getMiddleware(epicMiddleware);
    store = configureStore({
      reducer,
      preloadedState,
      middleware,
    });
    epicMiddleware.run(rootEpic as unknown as Epic);
  }

  return store;
};
