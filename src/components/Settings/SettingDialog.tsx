import { FloatingPortal } from '@floating-ui/react';
import { FC, useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Theme } from '@/src/types/settings';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import XMark from '../../../public/images/icons/xmark.svg';
import { ThemeSelect } from './ThemeSelect';
import { ToggleFullWidth } from './ToggleFullWidth';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SettingDialog: FC<Props> = ({ open, onClose }) => {
  const theme = useAppSelector(UISelectors.selectThemeState);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);

  const [localTheme, setLocalTheme] = useState(theme);
  const [isChatFullWidthLocal, setIsChatFullWidthLocal] =
    useState(isChatFullWidth);

  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Settings);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);

  useEffect(() => {
    setIsChatFullWidthLocal(isChatFullWidth);
  }, [isChatFullWidth]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        window.addEventListener('mouseup', handleMouseUp);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mouseup', handleMouseUp);
      onClose();
    };

    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose]);

  const onThemeChangeHandler = useCallback((theme: Theme) => {
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

  // Render nothing if the dialog is not open.
  if (!open) {
    return <></>;
  }

  // Render the dialog.
  return (
    <FloatingPortal id="theme-main">
      <div className="fixed inset-0 z-40 flex w-full items-center justify-center overflow-hidden bg-gray-900/30 p-3 dark:bg-gray-900/70">
        <div
          ref={modalRef}
          className="relative inline-block max-h-full w-[500px] overflow-y-auto rounded bg-gray-100 p-4 text-left align-bottom transition-all dark:bg-gray-700 md:max-h-[400px]"
          role="dialog"
        >
          <button
            className="absolute right-2 top-2 rounded text-gray-500 hover:text-blue-700"
            onClick={onClose}
          >
            <XMark height={24} width={24} />
          </button>
          <div className="mb-4 text-base font-bold">{t('Settings')}</div>
          <div className="mb-4 flex flex-col gap-5">
            <ThemeSelect
              localTheme={localTheme}
              onThemeChangeHandler={onThemeChangeHandler}
            />
            <ToggleFullWidth
              isOn={isChatFullWidthLocal}
              handleSwitch={onChangeHandlerFullWidth}
            />
          </div>

          <div className="flex  justify-end">
            <button
              type="button"
              className="w-full rounded bg-blue-500 p-3 text-gray-100 hover:bg-blue-700 focus:border focus:border-gray-800 focus-visible:outline-none dark:focus:border-gray-200 md:w-fit"
              onClick={handleSave}
            >
              {t('Save')}
            </button>
          </div>
        </div>
      </div>
    </FloatingPortal>
  );
};

export default SettingDialog;
