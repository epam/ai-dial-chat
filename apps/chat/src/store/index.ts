import { NextRouter, useRouter } from 'next/router';

import { BehaviorSubject, switchMap } from 'rxjs';

import { Store, combineReducers, configureStore } from '@reduxjs/toolkit';

import { EpicMiddleware, createEpicMiddleware } from 'redux-observable';

import { LocalesService } from '@/src/utils/app/data/locales-service';
import { initResourceMaxSegmentBytes } from '@/src/utils/app/resource-limits';

import { AppAction, RootState } from '@/src/types/store';

import { DEFAULT_RESOURCE_MAX_SEGMENT_BYTES } from '@/src/constants/default-ui-settings';

import { applicationSlice } from './application/application.reducers';
import { applicationTypesSchemasSlice } from './applicationTypeSchemas/applicationTypeSchemas.reducers';
import { authSlice } from './auth/auth.reducers';
import { chatEventsSlice } from './chat-events/chat-events.reducer';
import { chatSlice } from './chat/chat.reducer';
import { codeEditorSlice } from './codeEditor/codeEditor.reducer';
import { conversationsSlice } from './conversations/conversations.reducers';
import { filesSlice } from './files/files.reducers';
import { foldersSlice } from './folders/folders.reducers';
import { importExportSlice } from './import-export/importExport.reducers';
import { marketplaceSlice } from './marketplace/marketplace.reducers';
import { migrationSlice } from './migration/migration.reducers';
import { modelsSlice } from './models/models.reducers';
import { overlaySlice } from './overlay/overlay.reducers';
import { promptsSlice } from './prompts/prompts.reducers';
import { publicationSlice } from './publication/publication.reducers';
import { rootEpic } from './rootEpic';
import { serviceSlice } from './service/service.reducer';
import { settingsSlice } from './settings/settings.reducers';
import { SettingsState } from './settings/settings.types';
import { shareSlice } from './share/share.reducers';
import { toolsetSlice } from './toolset/toolset.reducer';
import { uiSlice } from './ui/ui.reducers';

interface NodeModuleWithHot extends NodeJS.Module {
  hot: {
    accept: (path: string | string[], callback: () => void) => void;
  };
}

const epic$ = new BehaviorSubject(rootEpic);
const hotReloadingEpic = (...args: Parameters<typeof rootEpic>) =>
  epic$.pipe(switchMap((epic) => epic(...args)));

export const rootReducer = combineReducers({
  models: modelsSlice.reducer,
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
  codeEditor: codeEditorSlice.reducer,
  applicationTypesSchemas: applicationTypesSchemasSlice.reducer,
  chat: chatSlice.reducer,
  folders: foldersSlice.reducer,
  toolset: toolsetSlice.reducer,
  chatEvents: chatEventsSlice.reducer,
});

const getMiddleware = (
  epicMiddleware: EpicMiddleware<
    AppAction,
    AppAction,
    RootState,
    { router: NextRouter }
  >,
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getDefaultMiddleware: any) => {
    return getDefaultMiddleware({
      thunk: false,
      serializableCheck: false,
    }).concat(epicMiddleware);
  };
};
let store: Store;
export type AppStore = ReturnType<typeof createStore>;
export type AppDispatch = typeof store.dispatch;

export const createStore = (preloadedState: { settings: SettingsState }) => {
  initResourceMaxSegmentBytes(
    preloadedState.settings?.resourceMaxSegmentBytes ??
      DEFAULT_RESOURCE_MAX_SEGMENT_BYTES,
  );

  LocalesService.setAvailableLocales(preloadedState.settings?.availableLocales);

  if (typeof window === 'undefined') {
    const epicMiddleware = createEpicMiddleware<
      AppAction,
      AppAction,
      RootState,
      { router: NextRouter }
    >({
      dependencies: { router: useRouter() },
    });

    const middleware = getMiddleware(epicMiddleware);
    const localStore = configureStore({
      reducer: rootReducer,
      preloadedState,
      middleware,
    });
    epicMiddleware.run(rootEpic);

    return localStore;
  }

  if (!store) {
    const epicMiddleware = createEpicMiddleware<
      AppAction,
      AppAction,
      RootState,
      { router: NextRouter }
    >({
      dependencies: { router: useRouter() },
    });

    const middleware = getMiddleware(epicMiddleware);
    store = configureStore({
      reducer: rootReducer,
      preloadedState,
      middleware,
    });
    epicMiddleware.run(hotReloadingEpic);

    if ((module as NodeModuleWithHot).hot) {
      (module as NodeModuleWithHot).hot.accept('./rootEpic', async () => {
        const next = await import('./rootEpic');
        epic$.next(next.rootEpic);
      });
    }
  }

  return store;
};
