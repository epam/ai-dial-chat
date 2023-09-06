import { AddonsEpics } from './addons/addons.epics';
import { addonsSlice } from './addons/addons.reducers';
import { ConversationsEpics } from './conversations/conversations.epics';
import { conversationsSlice } from './conversations/conversations.reducers';
import { ModelsEpics } from './models/models.epics';
import { modelsSlice } from './models/models.reducers';
import { PromptsEpics } from './prompts/prompts.epics';
import { promptsSlice } from './prompts/prompts.reducers';
import { settingsSlice } from './settings/settings.reducers';
import UIEpics from './ui/ui.epics';
import { uiSlice } from './ui/ui.reducers';

import { configureStore } from '@reduxjs/toolkit';
import { Epic, combineEpics, createEpicMiddleware } from 'redux-observable';

export const rootEpic = combineEpics(
  ModelsEpics,
  AddonsEpics,
  UIEpics,
  PromptsEpics,
  ConversationsEpics,
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
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(epicMiddleware),
});

epicMiddleware.run(rootEpic as unknown as Epic);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
