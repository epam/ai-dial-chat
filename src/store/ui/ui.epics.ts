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

import { UIActions, UISelectors } from './ui.reducers';

const initEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.init.match),
    switchMap(() =>
      forkJoin({
        theme: DataService.getTheme(),
        showChatbar: DataService.getShowChatbar(),
        showPromptbar: DataService.getShowPromptbar(),
        openedFoldersIds: DataService.getOpenedFolderIds(),
        textOfClosedAnnouncement: DataService.getClosedAnnouncement(),
      }),
    ),
    switchMap(
      ({
        theme,
        openedFoldersIds,
        showChatbar,
        showPromptbar,
        textOfClosedAnnouncement,
      }) => {
        const actions = [];

        actions.push(UIActions.setTheme(theme));
        actions.push(UIActions.setShowChatbar(showChatbar));
        actions.push(UIActions.setShowPromptbar(showPromptbar));
        actions.push(UIActions.setOpenedFoldersIds(openedFoldersIds));
        actions.push(
          UIActions.closeAnnouncement({
            announcement: textOfClosedAnnouncement,
          }),
        );

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

const UIEpics = combineEpics(
  initEpic,
  saveThemeEpic,
  saveShowChatbarEpic,
  saveShowPromptbarEpic,
  showToastErrorEpic,
  saveOpenedFoldersIdsEpic,
  closeAnnouncementEpic,
);

export default UIEpics;
