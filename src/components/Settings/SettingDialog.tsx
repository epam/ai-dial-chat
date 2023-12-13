import { FloatingPortal } from '@floating-ui/react';
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
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import XMark from '../../../public/images/icons/xmark.svg';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const SettingDialog: FC<Props> = ({ open, onClose }) => {
  const theme = useAppSelector(UISelectors.selectThemeState);

  const [localTheme, setLocalTheme] = useState(theme);

  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Settings);

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
    onClose();
  }, [dispatch, localTheme, onClose]);

  // Render nothing if the dialog is not open.
  if (!open) {
    return <></>;
  }

  // Render the dialog.
  return (
    <FloatingPortal id="theme-main">
      <div className="fixed inset-0 z-40 flex w-full items-center justify-center overflow-hidden bg-blackout p-3">
        <div
          ref={modalRef}
          className="relative inline-block max-h-full w-[500px] overflow-y-auto rounded bg-layer-3 p-4 text-left align-bottom transition-all md:max-h-[400px]"
          role="dialog"
        >
          <button
            className="hover:text-blue-700 absolute right-2 top-2 rounded text-secondary"
            onClick={onClose}
          >
            <XMark height={24} width={24} />
          </button>
          <div className="mb-4 text-base font-bold">{t('Settings')}</div>
          <div className="mb-4">
            <div className="flex items-center gap-5">
              <div className="w-[120px]">{t('Theme')}</div>
              <div className="border-gray-400 focus-within:border-blue-500 focus:border-blue-500 w-full rounded border px-3">
                <select
                  className="h-[38px] w-full cursor-pointer rounded border-none focus:outline-none"
                  value={localTheme}
                  onChange={onThemeChangeHandler}
                >
                  <option className="border-none" value="dark">
                    {t('Dark')}
                  </option>
                  <option className="" value="light">
                    {t('Light')}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="button button-primary"
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
