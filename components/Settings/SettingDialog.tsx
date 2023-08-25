import { ChangeEventHandler, FC, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';

import { useTranslation } from 'next-i18next';

import { useAppSelector } from '@/store/hooks';
import {
  ThemeType,
  selectThemeState,
  setTheme,
} from '@/store/ui-store/ui.reducers';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const SettingDialog: FC<Props> = ({ open, onClose }) => {
  //New Redux state
  const theme = useAppSelector(selectThemeState);

  const dispatch = useDispatch();

  const { t } = useTranslation('settings');

  const modalRef = useRef<HTMLDivElement>(null);

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

  const onThemeChangeHandler: ChangeEventHandler<HTMLSelectElement> = (
    event,
  ) => {
    const theme = event.target.value as ThemeType;
    dispatch(setTheme(theme));
  };

  // Render nothing if the dialog is not open.
  if (!open) {
    return <></>;
  }

  // Render the dialog.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="fixed inset-0 z-10 overflow-hidden">
        <div className="flex min-h-screen items-center justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
          <div
            className="hidden sm:inline-block sm:h-screen sm:align-middle"
            aria-hidden="true"
          />

          <div
            ref={modalRef}
            className="dark:border-netural-400 inline-block max-h-[400px] overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 pb-4 pt-5 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-h-[600px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
            role="dialog"
          >
            <div className="pb-4 text-lg font-bold text-black dark:text-neutral-200">
              {t('Settings')}
            </div>

            <div className="mb-2 text-sm font-bold text-black dark:text-neutral-200">
              {t('Theme')}
            </div>

            <select
              className="w-full cursor-pointer bg-transparent p-2 text-neutral-700 dark:text-neutral-200"
              value={theme}
              onChange={onThemeChangeHandler}
            >
              <option
                className="!dark:hover:bg-black appearance-none dark:bg-[#343541]"
                value="dark"
              >
                {t('Dark mode')}
              </option>
              <option
                className="!dark:hover:bg-black appearance-none dark:bg-[#343541]"
                value="light"
              >
                {t('Light mode')}
              </option>
            </select>

            {/* <button
              type="button"
              className="mt-6 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
              onClick={() => {
                // handleSave();
                onClose();
              }}
            >
              {t('Save')}
            </button> */}
          </div>
        </div>
      </div>
    </div>
  );
};
