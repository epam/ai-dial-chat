import { IconX } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import Modal from '@/src/components/Common/Modal';

import { ToggleSwitchLabeled } from '../Common/ToggleSwitch/ToggleSwitchLabeled';
import { ThemeSelect } from './ThemeSelect';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const SettingDialog: FC<Props> = ({ open, onClose }) => {
  const theme = useAppSelector(UISelectors.selectThemeState);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);

  const [localTheme, setLocalTheme] = useState(theme);
  const [isChatFullWidthLocal, setIsChatFullWidthLocal] =
    useState(isChatFullWidth);

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

  const handleSave = useCallback(() => {
    dispatch(UIActions.setTheme(localTheme));
    dispatch(UIActions.setIsChatFullWidth(isChatFullWidthLocal));
    onClose();
  }, [dispatch, localTheme, onClose, isChatFullWidthLocal]);

  if (!open) {
    return <></>;
  }

  return (
    <Modal
      portalId="theme-main"
      containerClassName="relative inline-block max-h-full w-[500px] overflow-y-auto rounded bg-layer-3 p-4 text-left align-bottom transition-all md:max-h-[400px]"
      dataQa="settings-modal"
      isOpen={open}
      onClose={onClose}
      initialFocus={saveBtnRef}
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
    </Modal>
  );
};
