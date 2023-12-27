import { toast } from 'react-hot-toast';

import {
  concat,
  filter,
  forkJoin,
  ignoreElements,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { combineEpics } from 'redux-observable';

import { DataService } from '@/src/utils/app/data/data-service';

import { AppEpic } from '@/src/types/store';

import { errorsMessages } from '@/src/constants/errors';

import { SettingsSelectors } from '../settings/settings.reducers';
import { UIActions, UISelectors } from './ui.reducers';

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(UIActions.init.match),
    switchMap(() => {
      const isThemesDefined = SettingsSelectors.selectThemeHostDefined(
        state$.value,
      );

      return forkJoin({
        theme: DataService.getTheme(),
        availableThemes: isThemesDefined
          ? DataService.getAvailableThemes()
          : [],
        showChatbar: DataService.getShowChatbar(),
        showPromptbar: DataService.getShowPromptbar(),
        openedFoldersIds: DataService.getOpenedFolderIds(),
        textOfClosedAnnouncement: DataService.getClosedAnnouncement(),
        chatbarWidth: DataService.getChatbarWidth(),
        promptbarWidth: DataService.getPromptbarWidth(),
        isChatFullWidth: DataService.getIsChatFullWidth(),
      });
    }),
    switchMap(
      ({
        theme,
        availableThemes,
        openedFoldersIds,
        showChatbar,
        showPromptbar,
        textOfClosedAnnouncement,
        chatbarWidth,
        promptbarWidth,
        isChatFullWidth,
      }) => {
        const actions = [];

        if (theme) {
          actions.push(UIActions.setTheme(theme));
        } else {
          actions.push(UIActions.setTheme(availableThemes[0]?.id));
        }
        actions.push(UIActions.setAvailableThemes(availableThemes));
        actions.push(UIActions.setShowChatbar(showChatbar));
        actions.push(UIActions.setShowPromptbar(showPromptbar));
        actions.push(UIActions.setOpenedFoldersIds(openedFoldersIds));
        actions.push(
          UIActions.closeAnnouncement({
            announcement: textOfClosedAnnouncement,
          }),
        );
        actions.push(UIActions.setChatbarWidth(chatbarWidth));
        actions.push(UIActions.setPromptbarWidth(promptbarWidth));
        actions.push(UIActions.setIsChatFullWidth(isChatFullWidth));

        return concat(actions);
      },
    ),
  );

const saveThemeEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.setTheme.match),
    tap(({ payload }) => {
      // Needed for fast work with theme initial load
      document.documentElement.className = payload || '';
    }),
    switchMap(({ payload }) => DataService.setTheme(payload)),
    ignoreElements(),
  );

const saveShowChatbarEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.setShowChatbar.match),
    switchMap(({ payload }) => DataService.setShowChatbar(payload)),
    ignoreElements(),
  );

const saveShowPromptbarEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.setShowPromptbar.match),
    switchMap(({ payload }) => DataService.setShowPromptbar(payload)),
    ignoreElements(),
  );

const showToastErrorEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.showToast.match),
    switchMap(({ payload }) => {
      return forkJoin({
        responseMessage:
          typeof payload.response !== 'undefined'
            ? (payload.response as Response).text()
            : of(undefined),
        payload: of(payload),
      });
    }),
    tap(({ payload, responseMessage }) => {
      let message = payload.message ?? errorsMessages.generalServer;
      if (
        payload.response &&
        responseMessage &&
        payload.response.status !== 504
      ) {
        message = responseMessage;
      }

      switch (payload.type) {
        case 'error':
          toast.error(message, { id: 'toast' });
          break;
        case 'loading':
          toast.loading(message, { id: 'toast' });
          break;
        case 'success':
          toast.success(message, { id: 'toast' });
          break;
        default:
          toast(message, { id: 'toast' });
          break;
      }
    }),
    ignoreElements(),
  );

const closeAnnouncementEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.closeAnnouncement.match),
    switchMap(({ payload }) =>
      DataService.setClosedAnnouncement(payload.announcement),
    ),
    ignoreElements(),
  );

const saveOpenedFoldersIdsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        UIActions.setOpenedFoldersIds.match(action) ||
        UIActions.toggleFolder.match(action) ||
        UIActions.openFolder.match(action) ||
        UIActions.closeFolder.match(action),
    ),
    map(() => {
      return UISelectors.selectOpenedFoldersIds(state$.value);
    }),
    switchMap((openedFolderIds) =>
      DataService.setOpenedFolderIds(openedFolderIds),
    ),

    ignoreElements(),
  );

const saveChatbarWidthEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.setChatbarWidth.match),
    switchMap(({ payload }) => DataService.setChatbarWidth(payload)),
    ignoreElements(),
  );

const savePromptbarWidthEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.setPromptbarWidth.match),
    switchMap(({ payload }) => DataService.setPromptbarWidth(payload)),
    ignoreElements(),
  );

const saveIsChatFullWidthEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.setIsChatFullWidth.match),
    switchMap(({ payload }) => DataService.setIsChatFullWidth(payload)),
    ignoreElements(),
  );

const UIEpics = combineEpics(
  initEpic,
  saveThemeEpic,
  saveShowChatbarEpic,
  saveShowPromptbarEpic,
  showToastErrorEpic,
  saveOpenedFoldersIdsEpic,
  closeAnnouncementEpic,
  saveChatbarWidthEpic,
  savePromptbarWidthEpic,
  saveIsChatFullWidthEpic,
);

export default UIEpics;
