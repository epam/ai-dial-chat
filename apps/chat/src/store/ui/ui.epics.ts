import { ToastOptions, toast } from 'react-hot-toast';

import {
  EMPTY,
  Observable,
  concat,
  filter,
  forkJoin,
  ignoreElements,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { DataService } from '@/src/utils/app/data/data-service';
import {
  isSmallScreen,
  isTabletScreen,
  isTabletScreenOrMobile,
} from '@/src/utils/app/mobile';

import { FeatureType } from '@/src/types/common';
import { AppAction, AppEpic } from '@/src/types/store';
import { ToastType } from '@/src/types/toasts';

import { UIActions } from '@/src/store/actions';
import { SettingsSelectors, UISelectors } from '@/src/store/selectors';

import { errorsMessages } from '@/src/constants/errors';

import { Spinner } from '@/src/components/Common/Spinner';

import { Feature } from '@epam/ai-dial-shared';

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(UIActions.init.type),
    filter(() => !UISelectors.selectInitialized(state$.value)),
    switchMap(() => {
      const state = state$.value;
      const enabledFeatures = SettingsSelectors.selectEnabledFeatures(state);

      return forkJoin({
        showChatbar: DataService.getShowChatbar(
          enabledFeatures.has(Feature.ShowConversationsSectionByDefault) &&
            !isTabletScreenOrMobile(),
        ),
        showPromptbar: DataService.getShowPromptbar(
          enabledFeatures.has(Feature.ShowPromptsSectionByDefault) &&
            !isTabletScreenOrMobile(),
        ),
        showMarketplaceFilterbar: DataService.getShowMarketplaceFilterbar(
          enabledFeatures.has(Feature.Marketplace) && !isTabletScreenOrMobile(),
        ),
        textOfClosedAnnouncement: DataService.getClosedAnnouncement(),
        chatbarWidth: DataService.getChatbarWidth(),
        promptbarWidth: DataService.getPromptbarWidth(),
        isChatFullWidth: DataService.getIsChatFullWidth(),
        customLogo: DataService.getCustomLogo(),
        chatCollapsedSections: DataService.getChatCollapsedSections(),
        promptCollapsedSections: DataService.getPromptCollapsedSections(),
        fileCollapsedSections: DataService.getFileCollapsedSections(),
      });
    }),
    switchMap(
      ({
        showChatbar,
        showPromptbar,
        showMarketplaceFilterbar,
        textOfClosedAnnouncement,
        chatbarWidth,
        promptbarWidth,
        isChatFullWidth,
        customLogo,
        chatCollapsedSections,
        promptCollapsedSections,
        fileCollapsedSections,
      }) => {
        const actions: AppAction[] = [UIActions.initTheme()];

        if (customLogo) {
          actions.push(UIActions.setCustomLogo({ logo: customLogo }));
        }

        actions.push(UIActions.setShowChatbar(showChatbar));
        actions.push(UIActions.setShowPromptbar(showPromptbar));
        actions.push(
          UIActions.setShowMarketplaceFilterbar(showMarketplaceFilterbar),
        );
        actions.push(
          UIActions.closeAnnouncement({
            announcement: textOfClosedAnnouncement,
          }),
        );
        actions.push(UIActions.setChatbarWidth(chatbarWidth));
        actions.push(UIActions.setPromptbarWidth(promptbarWidth));
        actions.push(UIActions.setIsChatFullWidth(isChatFullWidth));
        actions.push(
          UIActions.setCollapsedSections({
            featureType: FeatureType.Chat,
            collapsedSections: chatCollapsedSections,
          }),
        );
        actions.push(
          UIActions.setCollapsedSections({
            featureType: FeatureType.Prompt,
            collapsedSections: promptCollapsedSections,
          }),
        );
        actions.push(
          UIActions.setCollapsedSections({
            featureType: FeatureType.File,
            collapsedSections: fileCollapsedSections,
          }),
        );
        actions.push(UIActions.initFinish());

        return concat(actions);
      },
    ),
  );

const initThemeEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(UIActions.initTheme.type),
    switchMap(() => {
      const state = state$.value;

      const theme = UISelectors.selectThemeState(state);

      if (theme) {
        return EMPTY;
      }

      const isThemesDefined = SettingsSelectors.selectThemeHostDefined(state);

      return forkJoin({
        theme: DataService.getTheme(),
        availableThemes: isThemesDefined
          ? DataService.getAvailableThemes()
          : of([]),
      }).pipe(
        switchMap(({ theme, availableThemes }) => {
          const actions: Observable<AppAction>[] = [];

          if (
            theme &&
            availableThemes.some(
              (availableTheme) => availableTheme.id === theme,
            )
          ) {
            actions.push(of(UIActions.setTheme(theme)));
          } else if (typeof availableThemes[0] !== 'undefined') {
            actions.push(of(UIActions.setTheme(availableThemes[0]?.id)));
          }

          return concat(
            ...actions,
            of(UIActions.setAvailableThemes(availableThemes)),
          );
        }),
      );
    }),
  );

const saveThemeEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.setTheme.type),
    tap(({ payload }) => {
      // Needed for fast work with theme initial load
      document.documentElement.className =
        `${payload} ${payload.startsWith('dark') ? 'dark' : 'light'}` || '';
    }),
    switchMap(({ payload }) => DataService.setTheme(payload)),
    ignoreElements(),
  );

const saveShowChatbarEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.setShowChatbar.type),
    switchMap(({ payload }) => DataService.setShowChatbar(payload)),
    ignoreElements(),
  );

const saveShowPromptbarEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.setShowPromptbar.type),
    switchMap(({ payload }) => DataService.setShowPromptbar(payload)),
    ignoreElements(),
  );

const saveShowMarketplaceFilterbarEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.setShowMarketplaceFilterbar.type),
    switchMap(({ payload }) =>
      DataService.setShowMarketplaceFilterbar(payload),
    ),
    ignoreElements(),
  );

const showErrorToastEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.showErrorToast.type),
    switchMap(({ payload }) =>
      of(UIActions.showToast({ message: payload, type: ToastType.Error })),
    ),
  );

const showWarningToastEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.showWarningToast.type),
    switchMap(({ payload }) =>
      of(UIActions.showToast({ message: payload, type: ToastType.Warning })),
    ),
  );

const showInfoToastEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.showInfoToast.type),
    switchMap(({ payload }) =>
      of(UIActions.showToast({ message: payload, type: ToastType.Info })),
    ),
  );

const showSuccessToastEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.showSuccessToast.type),
    switchMap(({ payload }) =>
      of(UIActions.showToast({ message: payload, type: ToastType.Success })),
    ),
  );

const showLoadingToastEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.showLoadingToast.type),
    switchMap(({ payload }) =>
      of(
        UIActions.showToast({
          message: payload,
          type: ToastType.Loading,
          icon: Spinner({ className: 'text-info', size: 18 }),
        }),
      ),
    ),
  );

const showToastEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.showToast.type),
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
        icon: payload.icon,
      };

      switch (payload.type) {
        case ToastType.Error:
          toast.error(message, { ...toastConfig, id: ToastType.Error });
          break;
        case ToastType.Success:
          toast.success(message, { ...toastConfig, id: ToastType.Success });
          break;
        case ToastType.Warning:
          toast.loading(message, { ...toastConfig, id: ToastType.Warning });
          break;
        case ToastType.Loading:
          toast.loading(message, { ...toastConfig, id: ToastType.Loading });
          break;
        default:
          toast.loading(message, { ...toastConfig, id: ToastType.Info });
          break;
      }
    }),
    ignoreElements(),
  );

const closeAnnouncementEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.closeAnnouncement.type),
    switchMap(({ payload }) =>
      DataService.setClosedAnnouncement(payload.announcement),
    ),
    ignoreElements(),
  );

const saveChatbarWidthEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.setChatbarWidth.type),
    switchMap(({ payload }) => DataService.setChatbarWidth(payload)),
    ignoreElements(),
  );

const savePromptbarWidthEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.setPromptbarWidth.type),
    switchMap(({ payload }) => DataService.setPromptbarWidth(payload)),
    ignoreElements(),
  );

const saveIsChatFullWidthEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.setIsChatFullWidth.type),
    switchMap(({ payload }) => DataService.setIsChatFullWidth(payload)),
    ignoreElements(),
  );

const resizeEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(UIActions.resize.type),
    switchMap(() => {
      const actions: Observable<AppAction>[] = [];
      const state = state$.value;

      const showChatbar = UISelectors.selectShowChatbar(state);
      const showPromptbar = UISelectors.selectShowPromptbar(state);
      const isProfileOpen = UISelectors.selectIsProfileOpen(state);
      const isUserSettingsOpen = UISelectors.selectIsUserSettingsOpen(state);

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

      if (isTabletScreen()) {
        if (
          [showChatbar, showPromptbar].filter(Boolean).length > 1 // more then one panel open for the medium screen)
        ) {
          actions.push(of(UIActions.setShowPromptbar(false)));
        }
      }

      return concat(...actions);
    }),
  );

const setCustomLogoEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.setCustomLogo.type),
    switchMap(({ payload }) => DataService.setCustomLogo(payload.logo)),
    ignoreElements(),
  );

const deleteCustomLogoEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.deleteCustomLogo.type),
    switchMap(() => DataService.setCustomLogo('')),
    ignoreElements(),
  );

const setCollapsedSectionsEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.setCollapsedSections.type),
    switchMap(({ payload }) => {
      if (payload.featureType === FeatureType.Chat) {
        return DataService.setChatCollapsedSections(payload.collapsedSections);
      }

      if (payload.featureType === FeatureType.Prompt) {
        return DataService.setPromptCollapsedSections(
          payload.collapsedSections,
        );
      }

      return DataService.setFileCollapsedSections(payload.collapsedSections);
    }),
    ignoreElements(),
  );

export const UIEpics = combineEpics(
  initEpic,
  initThemeEpic,
  saveThemeEpic,
  saveShowChatbarEpic,
  saveShowPromptbarEpic,
  saveShowMarketplaceFilterbarEpic,
  showToastEpic,
  showErrorToastEpic,
  showWarningToastEpic,
  showInfoToastEpic,
  showSuccessToastEpic,
  showLoadingToastEpic,
  closeAnnouncementEpic,
  saveChatbarWidthEpic,
  savePromptbarWidthEpic,
  saveIsChatFullWidthEpic,
  setCustomLogoEpic,
  setCollapsedSectionsEpic,
  deleteCustomLogoEpic,
  resizeEpic,
);
