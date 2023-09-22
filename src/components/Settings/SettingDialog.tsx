import {
  ChangeEventHandler,
  FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { Theme } from '@/src/types/settings';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const SettingDialog: FC<Props> = ({ open, onClose }) => {
  const theme = useAppSelector(UISelectors.selectThemeState);

  const [localTheme, setLocalTheme] = useState(theme);

  const dispatch = useAppDispatch();

  const { t } = useTranslation('settings');

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);

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

  const onThemeChangeHandler: ChangeEventHandler<HTMLSelectElement> =
    useCallback((event) => {
      const theme = event.target.value as Theme;
      setLocalTheme(theme);
    }, []);

  const handleSave = useCallback(() => {
    dispatch(UIActions.setTheme(localTheme));
  }, [dispatch, localTheme]);

  // Render nothing if the dialog is not open.
  if (!open) {
    return <></>;
  }

  // Render the dialog.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70">
      <div className="fixed inset-0 z-10 overflow-hidden">
        <div className="flex min-h-screen items-center justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
          <div
            className="hidden sm:inline-block sm:h-screen sm:align-middle"
            aria-hidden="true"
          />

          <div
            ref={modalRef}
            className="inline-block max-h-[400px] overflow-y-auto rounded bg-gray-100 px-4 pb-4 pt-5 text-left align-bottom shadow-xl transition-all dark:bg-gray-700 sm:my-8 sm:max-h-[600px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
            role="dialog"
          >
            <div className="pb-4 font-bold">{t('Settings')}</div>

            <div className="mb-2 font-bold">{t('Theme')}</div>

            <select
              className="w-full cursor-pointer p-2 dark:bg-gray-700"
              value={localTheme}
              onChange={onThemeChangeHandler}
            >
              <option className="dark:bg-gray-700" value="dark">
                {t('Dark mode')}
              </option>
              <option className="dark:bg-gray-700" value="light">
                {t('Light mode')}
              </option>
            </select>

            <button
              type="button"
              className="mt-6 w-full rounded border px-4 py-2 shadow focus:outline-none"
              onClick={() => {
                handleSave();
                onClose();
              }}
            >
              {t('Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
