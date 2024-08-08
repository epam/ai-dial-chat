import { IconX } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { splitEntityId } from '@/src/utils/app/folders';
import { isSmallScreen } from '@/src/utils/app/mobile';

import { DialFile } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import Modal from '@/src/components/Common/Modal';

import { ToggleSwitchLabeled } from '../Common/ToggleSwitch/ToggleSwitchLabeled';
import { CustomLogoSelect } from './CustomLogoSelect';
import { ThemeSelect } from './ThemeSelect';

import { Feature } from '@epam/ai-dial-shared';

interface Props {
  open: boolean;
  onClose: () => void;
}

const getCustomLogoLocalStoreName = (customLogoId: string | undefined) =>
  customLogoId && splitEntityId(customLogoId).name;

export const SettingDialog: FC<Props> = ({ open, onClose }) => {
  const theme = useAppSelector(UISelectors.selectThemeState);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const customLogoId = useAppSelector(UISelectors.selectCustomLogo);
  const isCustomLogoFeatureEnabled: boolean = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CustomLogo),
  );

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

  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Settings);

  const handleClose = useCallback(() => {
    setLocalTheme(theme);
    setIsChatFullWidthLocal(isChatFullWidth);
    setLocalLogoFile(undefined);
    setDeleteLogo(false);
    onClose();
  }, [onClose, isChatFullWidth, theme]);

  useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);

  useEffect(() => {
    setIsChatFullWidthLocal(isChatFullWidth);
  }, [isChatFullWidth]);

  const onThemeChangeHandler = useCallback((theme: string) => {
    setLocalTheme(theme);
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

  const handleSave = useCallback(() => {
    dispatch(UIActions.setTheme(localTheme));
    dispatch(UIActions.setIsChatFullWidth(isChatFullWidthLocal));
    if (localLogoFile && !deleteLogo) {
      dispatch(UIActions.setCustomLogo({ logo: localLogoFile.id }));
    }
    if (deleteLogo) {
      dispatch(UIActions.deleteCustomLogo());
    }

    setLocalLogoFile(undefined);
    onClose();
  }, [
    dispatch,
    localTheme,
    onClose,
    isChatFullWidthLocal,
    localLogoFile,
    deleteLogo,
  ]);

  if (!open) {
    return <></>;
  }

  return (
    <Modal
      portalId="theme-main"
      containerClassName="inline-block w-[570px] overflow-y-auto align-bottom transition-all md:h-[220px] md:max-h-[400px]"
      dataQa="settings-modal"
      hideClose
      state={open ? ModalState.OPENED : ModalState.CLOSED}
      onClose={handleClose}
      initialFocus={saveBtnRef}
      dismissProps={{ outsidePressEvent: 'mousedown' }}
    >
      <div className="flex h-[80px] items-center justify-between bg-layer-3 px-5 py-4 text-xl font-medium text-primary-bg-dark">
        {t('Settings')}
        <button
          onClick={handleClose}
          className="self-start text-primary-bg-dark hover:text-accent-primary"
        >
          <IconX height={20} width={20} />
        </button>
      </div>

      <div className="flex h-[calc(100%-80px)] flex-col justify-between p-8">
        <div className="flex flex-col gap-5">
          <ThemeSelect
            localTheme={localTheme}
            onThemeChangeHandler={onThemeChangeHandler}
          />
          {isCustomLogoFeatureEnabled && (
            <CustomLogoSelect
              onLogoSelect={onLogoSelect}
              onDeleteLocalLogoHandler={onDeleteLocalLogoHandler}
              localLogo={
                deleteLogo
                  ? undefined
                  : (localLogoFile && localLogoFile.name) ??
                    customLogoLocalStoreName
              }
            />
          )}
          {!isSmallScreen() && (
            <ToggleSwitchLabeled
              isOn={isChatFullWidthLocal}
              labelText={t('Full width chat')}
              labelClassName="basis-1/3 md:basis-1/4 font-medium"
              handleSwitch={onChangeHandlerFullWidth}
            />
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            ref={saveBtnRef}
            className="button button-primary button-medium"
            data-qa="save"onClick={handleSave}
          >
            {t('Save')}
          </button>
        </div>
      </div>
    </Modal>
  );
};
