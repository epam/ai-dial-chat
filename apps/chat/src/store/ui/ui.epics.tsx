import { Renderable, ToastOptions, toast } from 'react-hot-toast';

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
import { FALLBACK_THEME_CONFIG } from '@/src/constants/themes';

import { Spinner } from '@/src/components/Common/Spinner';
import { TitledToastMessage } from '@/src/components/Toasts/TitledToastMessage';

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
        enterType: DataService.getEnterType(),
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
        enterType,
      }) => {
        const actions: AppAction[] = [UIActions.initTheme()];

        if (customLogo) {
          actions.push(UIActions.setCustomLogo({ logo: customLogo }));
        }

        actions.push(UIActions.setEnterType(enterType));
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
        savedTheme: DataService.getTheme(),
        themesConfig: isThemesDefined
          ? DataService.getThemesConfig()
          : of(FALLBACK_THEME_CONFIG),
      }).pipe(
        switchMap(({ savedTheme, themesConfig }) => {
          const actions: Observable<AppAction>[] = [];
          // if no saved theme, take the first available theme (dark) - new users
          const theme = savedTheme || themesConfig.themes[0]?.id;

          if (
            theme &&
            themesConfig.themes.some(
              (availableTheme) => availableTheme.id === theme,
            )
          ) {
            actions.push(of(UIActions.setTheme(theme)));
          } else {
            // try to set the last theme (usually light) - fallback for old users
            const lastTheme =
              themesConfig.themes[themesConfig.themes.length - 1];
            if (typeof lastTheme !== 'undefined') {
              actions.push(of(UIActions.setTheme(lastTheme.id)));
            }
          }

          return concat(
            ...actions,
            of(UIActions.setAvailableThemes(themesConfig)),
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

const saveEnterTypeEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(UIActions.setEnterType.type),
    switchMap(({ payload }) => DataService.setEnterType(payload)),
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

      let content: Renderable = message;
      if (payload.title) {
        content = (
          <TitledToastMessage title={payload.title} message={message} />
        );
      }

      switch (payload.type) {
        case ToastType.Error:
          toast.error(content, { ...toastConfig, id: ToastType.Error });
          break;
        case ToastType.Success:
          toast.success(content, { ...toastConfig, id: ToastType.Success });
          break;
        case ToastType.Warning:
          toast.loading(content, { ...toastConfig, id: ToastType.Warning });
          break;
        case ToastType.Loading:
          toast.loading(content, { ...toastConfig, id: ToastType.Loading });
          break;
        default:
          toast.loading(content, { ...toastConfig, id: ToastType.Info });
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
  saveEnterTypeEpic,
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
