import { IconX } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { splitEntityId } from '@/src/utils/app/folders';
import { ApiUtils } from '@/src/utils/server/api';

import { DialFile } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import Modal from '@/src/components/Common/Modal';

import { ToggleSwitchLabeled } from '../Common/ToggleSwitch/ToggleSwitchLabeled';
import { FileManagerModal } from '../Files/FileManagerModal';
import { CustomLogoSelect } from './CustomLogoSelect';
import { ThemeSelect } from './ThemeSelect';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const SettingDialog: FC<Props> = ({ open, onClose }) => {
  const theme = useAppSelector(UISelectors.selectThemeState);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const customLogoUrl = useAppSelector(UISelectors.selectCustomLogo);
  const maximumAttachmentsAmount = 1;
  const customLogoId = customLogoUrl && ApiUtils.decodeApiUrl(customLogoUrl);
  const customLogoLocalStoreName = useMemo(() => {
    return customLogoId && splitEntityId(customLogoId).name;
  }, [customLogoId]);

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

  const [isSelectFilesDialogOpened, setIsSelectFilesDialogOpened] =
    useState(false);

  const saveBtnRef = useRef<HTMLButtonElement>(null);

  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Settings);

  const handleClose = useCallback(() => {
    setLocalTheme(theme);
    setIsChatFullWidthLocal(isChatFullWidth);
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
    const selectedFileId = filesIds[0];
    const newFile = files.find((file) => file.id === selectedFileId);
    setLocalLogoFile(newFile);
  };

  const handleSave = useCallback(() => {
    dispatch(UIActions.setTheme(localTheme));
    dispatch(UIActions.setIsChatFullWidth(isChatFullWidthLocal));
    if (localLogoFile) {
      const logo = ApiUtils.encodeApiUrl(localLogoFile?.id);
      dispatch(UIActions.setCustomLogo({ logo }));
    }

    onClose();
  }, [dispatch, localTheme, onClose, isChatFullWidthLocal, localLogoFile]);

  if (!open) {
    return <></>;
  }

  return (
    <Modal
      portalId="theme-main"
      containerClassName="inline-block w-[500px] overflow-y-auto p-4 align-bottom transition-all md:max-h-[400px]"
      dataQa="settings-modal"
      state={open ? ModalState.OPENED : ModalState.CLOSED}
      onClose={onClose}
      initialFocus={saveBtnRef}
      dismissProps={{ outsidePressEvent: 'mousedown' }}
    >
      <button
        className="absolute right-2 top-2 rounded text-secondary hover:text-accent-primary"
        onClick={handleClose}
      >
        <IconX height={24} width={24} />
      </button>
      <div className="mb-4 text-base font-bold">{t('Settings')}</div>
      <div className="mb-4 flex flex-col gap-5">
        <ThemeSelect
          localTheme={localTheme}
          onThemeChangeHandler={onThemeChangeHandler}
        />
        <CustomLogoSelect
          setOpenFilesModal={setIsSelectFilesDialogOpened}
          localLogo={
            (localLogoFile && localLogoFile.name) ?? customLogoLocalStoreName
          }
        />
        <ToggleSwitchLabeled
          isOn={isChatFullWidthLocal}
          labelText={t('Full width chat')}
          labelClassName="basis-1/3 md:basis-1/4"
          handleSwitch={onChangeHandlerFullWidth}
          switchOnText={t('ON')}
          switchOFFText={t('OFF')}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          ref={saveBtnRef}
          className="button button-primary"
          onClick={handleSave}
        >
          {t('Save')}
        </button>
      </div>
      {isSelectFilesDialogOpened && (
        <FileManagerModal
          isOpen
          allowedTypes={['image/*']}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          onClose={(files: unknown) => {
            onLogoSelect(files as string[]);
            setIsSelectFilesDialogOpened(false);
          }}
          isInLogoSelect
        />
      )}
    </Modal>
  );
};
