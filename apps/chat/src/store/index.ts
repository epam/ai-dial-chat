import { Action, Store, configureStore } from '@reduxjs/toolkit';
import { CurriedGetDefaultMiddleware } from '@reduxjs/toolkit/dist/getDefaultMiddleware';

import {
  Epic,
  EpicMiddleware,
  combineEpics,
  createEpicMiddleware,
} from 'redux-observable';

import { AddonsEpics } from './addons/addons.epics';
import { addonsSlice } from './addons/addons.reducers';
import { ApplicationEpics } from './application/application.epics';
import { applicationSlice } from './application/application.reducers';
import { authSlice } from './auth/auth.reducers';
import { ConversationsEpics } from './conversations/conversations.epics';
import { conversationsSlice } from './conversations/conversations.reducers';
import { FilesEpics } from './files/files.epics';
import { filesSlice } from './files/files.reducers';
import { ImportExportEpics } from './import-export/importExport.epics';
import { importExportSlice } from './import-export/importExport.reducers';
import { marketplaceSlice } from './marketplace/marketplace.reducers';
import { MigrationEpics } from './migration/migration.epics';
import { migrationSlice } from './migration/migration.reducers';
import { ModelsEpics } from './models/models.epics';
import { modelsSlice } from './models/models.reducers';
import { OverlayEpics } from './overlay/overlay.epics';
import { overlaySlice } from './overlay/overlay.reducers';
import { PromptsEpics } from './prompts/prompts.epics';
import { promptsSlice } from './prompts/prompts.reducers';
import { PublicationEpics } from './publication/publication.epics';
import { publicationSlice } from './publication/publication.reducers';
import { ServiceEpics } from './service/service.epics';
import { serviceSlice } from './service/service.reducer';
import { SettingsEpics } from './settings/settings.epic';
import { SettingsState, settingsSlice } from './settings/settings.reducers';
import { ShareEpics } from './share/share.epics';
import { shareSlice } from './share/share.reducers';
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
  ImportExportEpics,
  ShareEpics,
  ServiceEpics,
  MigrationEpics,
  PublicationEpics,
  ApplicationEpics,
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
  auth: authSlice.reducer,
  importExport: importExportSlice.reducer,
  share: shareSlice.reducer,
  service: serviceSlice.reducer,
  migration: migrationSlice.reducer,
  publication: publicationSlice.reducer,
  application: applicationSlice.reducer,
  marketplace: marketplaceSlice.reducer,
};
const getMiddleware = (
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  epicMiddleware: EpicMiddleware<Action<any>, Action<any>, void, any>,
) => {
  return (getDefaultMiddleware: CurriedGetDefaultMiddleware) => {
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
