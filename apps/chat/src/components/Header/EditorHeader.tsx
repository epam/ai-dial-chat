import {
  IconAlertCircle,
  IconChevronDown,
  IconCircleCheck,
  IconCircleDot,
  IconCircleDotFilled,
  IconLogout,
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { PartialBy } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';
import { UIActions } from '@/src/store/ui/ui.reducers';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import { Logo } from '@/src/components/Header/Logo';
import { User } from '@/src/components/Header/User/User';
import { SettingDialog } from '@/src/components/Settings/SettingDialog';

const getTabIcon = <T extends string>(
  tab: T,
  activeTab: T,
  isEditing?: boolean,
  isDisabled?: boolean,
  isNotValid?: boolean,
) => {
  const selected = tab === activeTab;

  const Icon = selected
    ? IconCircleDotFilled
    : isNotValid
      ? IconAlertCircle
      : isEditing
        ? IconCircleCheck
        : IconCircleDot;
  const color = isDisabled
    ? 'text-secondary'
    : isNotValid
      ? 'text-error'
      : isEditing || selected
        ? 'text-accent-primary'
        : 'text-secondary';

  return (
    <Icon
      className={color}
      data-qa={selected ? 'selected-step-icon' : 'not-selected-step-icon'}
      width={24}
      height={24}
    />
  );
};

interface EditorHeaderTab<T extends string> {
  label: string;
  key: T;
  disabled: boolean;
}

interface EditorHeaderProps<T extends string> {
  dataQa?: string;
  tabs: EditorHeaderTab<T>[];
  activeTab: T;
  errorTabsSet?: Set<T>;
  onTabClick: (e: PartialBy<EditorHeaderTab<T>, 'label'>) => void;
  title: string;

  isEditing?: boolean;
  saveLabel?: string;
  getMobileTabLabel?: (tab: T) => string;
  onSave?: () => void;
}

export const EditorHeader = <T extends string>({
  dataQa,
  tabs,
  activeTab,
  errorTabsSet,
  onTabClick,
  title,

  isEditing,
  saveLabel,
  getMobileTabLabel = (tab: T) => tab,
  onSave,
}: EditorHeaderProps<T>) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const isUserSettingsOpen = useAppSelector(
    UISelectors.selectIsUserSettingsOpen,
  );

  const [menuOpen, setMenuOpen] = useState(false);

  const handleCloseUserSettings = useCallback(() => {
    dispatch(UIActions.setIsUserSettingsOpen(false));
  }, [dispatch]);

  const handleTabClose = useCallback(
    (tab: PartialBy<EditorHeaderTab<T>, 'label'>) => {
      onTabClick(tab);
      setMenuOpen(false);
    },
    [onTabClick],
  );

  return (
    <div
      className={classNames(
        'z-40 flex w-full border-b border-secondary bg-layer-1',
        isOverlay ? 'min-h-[36px]' : 'min-h-[48px]',
      )}
      data-qa={dataQa}
    >
      <div className="flex grow items-center justify-between">
        <div className="flex h-full space-x-4">
          <div className="relative flex items-center md:hidden">
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-1 text-base font-medium text-primary"
            >
              {getMobileTabLabel(activeTab)}
              <IconChevronDown
                size={18}
                className={classNames(
                  'transition-transform',
                  menuOpen && 'rotate-180',
                )}
              />
            </button>

            {menuOpen && (
              <div className="absolute left-0 top-7 z-10 ml-3 mt-2 w-[168px] overflow-hidden rounded-md bg-layer-3">
                {tabs.map((tab) => {
                  const isDisabled = tab.disabled;
                  const isActive = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      onClick={() => handleTabClose(tab)}
                      disabled={isDisabled}
                      className={classNames(
                        'w-full px-3 py-2 text-left text-sm transition-colors',
                        {
                          'cursor-not-allowed text-secondary': isDisabled,
                          'bg-accent-primary-alpha': isActive && !isDisabled,
                          'hover:bg-gray-100': !isActive && !isDisabled,
                        },
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <span
            className="hidden items-center pl-1 text-primary md:flex xl:pl-0"
            data-qa="action-application-type-title"
          >
            {title}
          </span>

          <div
            className="hidden items-center md:flex"
            data-qa="steps-container"
          >
            {tabs.map((tab, index) => {
              const isDisabled = tab.disabled;
              const isNotValid = errorTabsSet?.has(tab.key) ?? false;
              return (
                <div key={tab.key} className="flex items-center">
                  <div
                    tabIndex={isDisabled ? -1 : undefined}
                    data-qa="single-step-link"
                    className={classNames(
                      'flex items-center gap-2 rounded px-2 py-1.5',
                      isDisabled
                        ? 'cursor-default text-secondary'
                        : 'cursor-pointer text-primary hover:bg-accent-primary-alpha',
                    )}
                    onClick={() => onTabClick(tab)}
                  >
                    {getTabIcon(
                      tab.key,
                      activeTab,
                      isEditing,
                      isDisabled,
                      isNotValid,
                    )}

                    <span className="grow truncate" data-qa="single-step-title">
                      {tab.label}
                    </span>
                  </div>
                  {index < tabs.length - 1 && (
                    <div
                      className="mx-2 h-0.5 w-5"
                      style={{ backgroundColor: 'var(--text-secondary)' }}
                    ></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="hidden h-full xl:flex">
          <Logo />
        </div>

        <div className="flex h-full items-center space-x-2 pr-3 md:pr-5 xl:pr-0">
          <button
            className="button flex items-center space-x-1 text-accent-primary max-xl:p-0 md:flex"
            onClick={onSave}
            data-qa="save-and-exit"
          >
            <IconLogout size={14} />
            <span>{t(saveLabel ?? 'Save and exit')}</span>
          </button>
          <div className="h-full max-xl:hidden max-md:pr-2 md:border-l md:border-secondary md:pl-2">
            <User />
          </div>
        </div>
      </div>

      <SettingDialog
        open={isUserSettingsOpen}
        onClose={handleCloseUserSettings}
      />
    </div>
  );
};
