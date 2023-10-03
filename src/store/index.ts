import { configureStore } from '@reduxjs/toolkit';

import { Epic, combineEpics, createEpicMiddleware } from 'redux-observable';

import { AddonsEpics } from './addons/addons.epics';
import { addonsSlice } from './addons/addons.reducers';
import { ConversationsEpics } from './conversations/conversations.epics';
import { conversationsSlice } from './conversations/conversations.reducers';
import { ModelsEpics } from './models/models.epics';
import { modelsSlice } from './models/models.reducers';
import { OverlayEventsEpics } from './overlay-events/overlay-events.epics';
import { overlayEventsSlice } from './overlay-events/overlay-events.reducers';
import { PromptsEpics } from './prompts/prompts.epics';
import { promptsSlice } from './prompts/prompts.reducers';
import { settingsSlice } from './settings/settings.reducers';
import UIEpics from './ui/ui.epics';
import { uiSlice } from './ui/ui.reducers';

export const rootEpic = combineEpics(
  ModelsEpics,
  AddonsEpics,
  UIEpics,
  PromptsEpics,
  ConversationsEpics,
  OverlayEventsEpics,
);
const epicMiddleware = createEpicMiddleware();

export const store = configureStore({
  reducer: {
    models: modelsSlice.reducer,
    addons: addonsSlice.reducer,
    ui: uiSlice.reducer,
    conversations: conversationsSlice.reducer,
    prompts: promptsSlice.reducer,
    settings: settingsSlice.reducer,
    overlayEvents: overlayEventsSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ thunk: false, serializableCheck: false }).concat(
      epicMiddleware,
    ),
});

epicMiddleware.run(rootEpic as unknown as Epic);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
