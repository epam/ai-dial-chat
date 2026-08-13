import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/router';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isTouchable } from '@/src/utils/app/mobile';
import { navigateToLocale } from '@/src/utils/app/navigateToLocale';
import { splitEntityId } from '@/src/utils/app/shared-utils';

import { ScreenState } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { EnterType } from '@/src/types/settings';
import { Translation } from '@/src/types/translation';

import { ModelsActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  FilesSelectors,
  ModelsSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { BYTES_IN_MB } from '@/src/constants/file';
import { SettingsI18nKeys } from '@/src/constants/i18n';
import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import { withLabel } from '@/src/components/Common/Forms/Label';
import { Modal } from '@/src/components/Common/Modal';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';
import { ToggleSwitchLabeled } from '@/src/components/Common/ToggleSwitch/ToggleSwitchLabeled';

import { CustomLogoSelect } from './CustomLogoSelect';
import { DefaultModelSelect } from './DefaultModelSelect';
import { EnterTypeSelectLabeled } from './EnterTypeSelect';
import { LanguageSelect } from './LanguageSelect';
import { ThemeSelect } from './ThemeSelect';

import { Feature } from '@epam/ai-dial-shared';
import { DialPrimaryButton } from '@epam/ai-dial-ui-kit';

const getCustomLogoLocalStoreName = (customLogoId: string | undefined) =>
  customLogoId && splitEntityId(customLogoId).name;

const view = withRenderWhen((state) => {
  const isOpen = UISelectors.selectIsUserSettingsOpen(state);
  const isUserMenuHidden = SettingsSelectors.isFeatureEnabled(
    state,
    Feature.HideUserMenu,
  );

  return isOpen && !isUserMenuHidden;
})(() => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const ToggleSwitchLabel = useMemo(() => withLabel(ToggleSwitchLabeled), []);

  const theme = useAppSelector(UISelectors.selectThemeState);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const customLogoId = useAppSelector(UISelectors.selectCustomLogo);
  const isCustomLogoFeatureEnabled: boolean = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CustomLogo),
  );
  const isChatFullWidthByDefault: boolean = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ChatFullWidthByDefault),
  );
  const savedDefaultModelReference = useAppSelector(
    ModelsSelectors.selectDefaultModelOption,
  );
  const savedEnterType = useAppSelector(UISelectors.selectEnterType);
  const savedLocale = useAppSelector(UISelectors.selectLocale);
  const availableLocales = useAppSelector(
    SettingsSelectors.selectAvailableLocales,
  );

  const [defaultModelReference, setDefaultModelReference] = useState<string>(
    savedDefaultModelReference,
  );

  const [enterType, setEnterType] = useState(savedEnterType);
  const [localLocale, setLocalLocale] = useState(savedLocale);

  const screenState = useScreenState();

  const handleCloseDialog = useCallback(() => {
    dispatch(UIActions.setIsUserSettingsOpen(false));
  }, [dispatch]);

  useEffect(() => {
    setDefaultModelReference(savedDefaultModelReference);
  }, [savedDefaultModelReference]);

  useEffect(() => {
    setEnterType(savedEnterType);
  }, [savedEnterType]);

  useEffect(() => {
    setLocalLocale(savedLocale);
  }, [savedLocale]);

  const customLogoLocalStoreName = useMemo(() => {
    return getCustomLogoLocalStoreName(customLogoId);
  }, [customLogoId]);

  const [deleteLogo, setDeleteLogo] = useState<boolean>(false);
  const [localTheme, setLocalTheme] = useState(theme);
  const [isChatFullWidthLocal, setIsChatFullWidthLocal] =
    useState(isChatFullWidth);
  const [localLogoFile, setLocalLogoFile] = useState<DialFile | undefined>(
    () => {
      if (customLogoId) {
        return files.find((file) => file.id === customLogoId);
      }
    },
  );

  const saveBtnRef = useRef<HTMLButtonElement>(null);

  const { t } = useTranslation(Translation.Settings);

  const handleClose = useCallback(() => {
    setLocalTheme(theme);
    setIsChatFullWidthLocal(isChatFullWidth);
    setLocalLogoFile(undefined);
    setDeleteLogo(false);
    setDefaultModelReference(savedDefaultModelReference);
    setEnterType(savedEnterType);
    setLocalLocale(savedLocale);
    handleCloseDialog();
  }, [
    theme,
    isChatFullWidth,
    savedDefaultModelReference,
    savedEnterType,
    savedLocale,
    handleCloseDialog,
  ]);

  useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);

  useEffect(() => {
    setIsChatFullWidthLocal(isChatFullWidth);
  }, [isChatFullWidth]);

  const onThemeChangeHandler = useCallback((theme: string) => {
    setLocalTheme(theme);
  }, []);

  const localeChangeHandler = useCallback((locale: string) => {
    setLocalLocale(locale);
  }, []);

  const onChangeHandlerFullWidth = useCallback(() => {
    setIsChatFullWidthLocal((prev) => !prev);
  }, []);

  const onLogoSelect = (filesIds: string[]) => {
    setDeleteLogo(false);
    const selectedFileId = filesIds[0];
    const newFile = files.find((file) => file.id === selectedFileId);
    setLocalLogoFile(newFile);
  };
  const onDeleteLocalLogoHandler = () => {
    setLocalLogoFile(undefined);
    setDeleteLogo(true);
  };

  const onModelChange = useCallback(
    (modelReference: string) => {
      setDefaultModelReference(modelReference);
    },
    [setDefaultModelReference],
  );

  const handleSave = useCallback(() => {
    dispatch(UIActions.setTheme(localTheme));
    dispatch(UIActions.setIsChatFullWidth(isChatFullWidthLocal));
    dispatch(UIActions.setEnterType(enterType));
    if (localLogoFile && !deleteLogo) {
      dispatch(UIActions.setCustomLogo({ logo: localLogoFile.id }));
    }
    if (deleteLogo) {
      dispatch(UIActions.deleteCustomLogo());
    }
    dispatch(ModelsActions.setDefaultModelReference(defaultModelReference));

    setLocalLogoFile(undefined);
    handleCloseDialog();

    if (localLocale !== savedLocale) {
      dispatch(UIActions.setLocale(localLocale));
      navigateToLocale(router, localLocale, availableLocales);
    }
  }, [
    dispatch,
    localTheme,
    isChatFullWidthLocal,
    enterType,
    localLogoFile,
    deleteLogo,
    defaultModelReference,
    handleCloseDialog,
    localLocale,
    savedLocale,
    router,
    availableLocales,
  ]);

  return (
    <Modal
      portalId="theme-main"
      containerClassName="flex flex-col w-[400px] overflow-hidden px-3 py-4 align-bottom transition-all md:p-6"
      dataQa="settings-modal"
      state={ModalState.OPENED}
      onClose={handleClose}
      initialFocus={saveBtnRef}
      dismissProps={OUTSIDE_PRESS_AND_MOUSE_EVENT}
    >
      <div className="shrink-0 pb-4 text-base font-bold">
        {t(SettingsI18nKeys.Settings)}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <ThemeSelect
          localTheme={localTheme}
          onThemeChangeHandler={onThemeChangeHandler}
        />
        <LanguageSelect
          currentLocale={localLocale}
          onLocaleChange={localeChangeHandler}
        />
        {isCustomLogoFeatureEnabled && (
          <CustomLogoSelect
            onLogoSelect={onLogoSelect}
            onDeleteLocalLogoHandler={onDeleteLocalLogoHandler}
            localLogo={
              deleteLogo
                ? undefined
                : ((localLogoFile && localLogoFile.name) ??
                  customLogoLocalStoreName)
            }
            title={t(SettingsI18nKeys.CustomLogo)}
            maxSelectableFileSize={BYTES_IN_MB * 0.5}
            isFormView
          />
        )}

        <DefaultModelSelect
          modelReference={defaultModelReference}
          onModelChange={onModelChange}
        />

        {screenState > ScreenState.SM && !isChatFullWidthByDefault && (
          <ToggleSwitchLabel
            label={t(SettingsI18nKeys.ChatWidth)}
            isOn={isChatFullWidthLocal}
            labelText={t(SettingsI18nKeys.ShowChatFullScreen)}
            labelClassName="grow"
            handleSwitch={onChangeHandlerFullWidth}
            switchOnText={t(SettingsI18nKeys.ON)}
            switchOFFText={t(SettingsI18nKeys.OFF)}
            isLabelOnRight
            className="mt-1"
          />
        )}
        {!isTouchable() && (
          <EnterTypeSelectLabeled
            label={t(SettingsI18nKeys.KeyboardShortcuts)}
            value={enterType}
            onValueChange={(value) => setEnterType(value as EnterType)}
          />
        )}
      </div>

      <div className="flex shrink-0 justify-end pt-4">
        <DialPrimaryButton
          label={t(SettingsI18nKeys.Save)}
          onClick={handleSave}
          data-qa="save"
          ref={saveBtnRef}
        />
      </div>
    </Modal>
  );
});

export const SettingDialog = view;
