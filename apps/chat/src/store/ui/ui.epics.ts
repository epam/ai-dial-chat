import { ToastOptions, toast } from 'react-hot-toast';

import {
  Observable,
  concat,
  filter,
  forkJoin,
  ignoreElements,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import { DataService } from '@/src/utils/app/data/data-service';
import { isSmallScreen } from '@/src/utils/app/mobile';

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
          : of([]),
        showChatbar: DataService.getShowChatbar(),
        showPromptbar: DataService.getShowPromptbar(),
        textOfClosedAnnouncement: DataService.getClosedAnnouncement(),
        chatbarWidth: DataService.getChatbarWidth(),
        promptbarWidth: DataService.getPromptbarWidth(),
        isChatFullWidth: DataService.getIsChatFullWidth(),
        customLogo: DataService.getCustomLogo(),
      });
    }),
    switchMap(
      ({
        theme,
        availableThemes,
        showChatbar,
        showPromptbar,
        textOfClosedAnnouncement,
        chatbarWidth,
        promptbarWidth,
        isChatFullWidth,
        customLogo,
      }) => {
        const actions = [];

        if (theme) {
          actions.push(UIActions.setTheme(theme));
        } else if (typeof availableThemes[0] !== 'undefined') {
          actions.push(UIActions.setTheme(availableThemes[0]?.id));
        }

        if (customLogo) {
          actions.push(UIActions.setCustomLogo({ logo: customLogo }));
        }

        actions.push(UIActions.setAvailableThemes(availableThemes));
        actions.push(UIActions.setShowChatbar(showChatbar));
        actions.push(UIActions.setShowPromptbar(showPromptbar));
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

const showErrorToastEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.showErrorToast.match),
    switchMap(({ payload }) =>
      of(UIActions.showToast({ message: payload, type: 'error' })),
    ),
  );

const showLoadingToastEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.showLoadingToast.match),
    switchMap(({ payload }) =>
      of(UIActions.showToast({ message: payload, type: 'loading' })),
    ),
  );

const showSuccessToastEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.showSuccessToast.match),
    switchMap(({ payload }) =>
      of(UIActions.showToast({ message: payload, type: 'success' })),
    ),
  );

const showToastEpic: AppEpic = (action$) =>
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

      const toastConfig: ToastOptions = {
        id: 'toast',
        className: 'chat-toast',
      };

      switch (payload.type) {
        case 'error':
          toast.error(message, toastConfig);
          break;
        case 'loading':
          toast.loading(message, toastConfig);
          break;
        case 'success':
          toast.success(message, toastConfig);
          break;
        default:
          toast(message, toastConfig);
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

const resizeEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(UIActions.resize.match),
    switchMap(() => {
      const showChatbar = UISelectors.selectShowChatbar(state$.value);
      const showPromptbar = UISelectors.selectShowPromptbar(state$.value);
      const isProfileOpen = UISelectors.selectIsProfileOpen(state$.value);
      const isUserSettingsOpen = UISelectors.selectIsUserSettingsOpen(
        state$.value,
      );
      const actions: Observable<AnyAction>[] = [];
      if (isSmallScreen()) {
        if (isUserSettingsOpen) {
          actions.push(of(UIActions.setIsUserSettingsOpen(false))); // hide desktop settings dialog
        }
        if (
          [showChatbar, showPromptbar, isProfileOpen].filter(Boolean).length > 1 // more then one panel open for small screen)
        ) {
          if (showChatbar) {
            actions.push(
              of(UIActions.setIsProfileOpen(false)),
              of(UIActions.setShowPromptbar(false)),
            );
          } else {
            actions.push(of(UIActions.setIsProfileOpen(false)));
          }
        }
      }
      return concat(...actions);
    }),
  );

const setCustomLogoEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.setCustomLogo.match),
    switchMap(({ payload }) => DataService.setCustomLogo(payload.logo)),
    ignoreElements(),
  );

const removeCustomLogoEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.removeCustomLogo.match),
    switchMap(() => DataService.setCustomLogo()),
    ignoreElements(),
  );

const UIEpics = combineEpics(
  initEpic,
  saveThemeEpic,
  saveShowChatbarEpic,
  saveShowPromptbarEpic,
  showToastEpic,
  showErrorToastEpic,
  showLoadingToastEpic,
  showSuccessToastEpic,
  closeAnnouncementEpic,
  saveChatbarWidthEpic,
  savePromptbarWidthEpic,
  saveIsChatFullWidthEpic,
  setCustomLogoEpic,
  removeCustomLogoEpic,
  resizeEpic,
);

export default UIEpics;
