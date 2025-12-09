import { IconChevronDown, IconLogout } from '@tabler/icons-react';
import { MouseEvent, useCallback, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { PartialBy } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';
import { UIActions } from '@/src/store/ui/ui.reducers';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import { Stepper } from '@/src/components/Common/Stepper';
import { Logo } from '@/src/components/Header/Logo';
import { User } from '@/src/components/Header/User/User';
import { SettingDialog } from '@/src/components/Settings/SettingDialog';

import { Feature } from '@epam/ai-dial-shared';

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
  onLogoClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
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
  onLogoClick,
}: EditorHeaderProps<T>) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const isUserSettingsOpen = useAppSelector(
    UISelectors.selectIsUserSettingsOpen,
  );
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
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
        'z-10 flex w-full border-b border-secondary bg-layer-1',
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
              <div className="absolute left-3 top-10 z-10 w-[calc(100%-1.4rem)] overflow-hidden rounded bg-layer-3">
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
            data-qa="action-entity-type-title"
          >
            {title}
          </span>

          <Stepper
            steps={tabs.map((tab) => ({
              key: tab.key,
              label: tab.label,
              disabled: tab.disabled,
              error: errorTabsSet?.has(tab.key) ?? false,
              completed: isEditing,
            }))}
            active={activeTab}
            onChange={onTabClick}
            className="hidden md:flex"
          />
        </div>

        <div className="hidden h-full xl:flex">
          <Logo onLogoClick={onLogoClick} />
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
          {!enabledFeatures.has(Feature.HideUserMenu) && (
            <div className="h-full max-xl:hidden max-md:pr-2 md:border-l md:border-secondary md:pl-2">
              <User />
            </div>
          )}
        </div>
      </div>

      <SettingDialog
        open={isUserSettingsOpen}
        onClose={handleCloseUserSettings}
      />
    </div>
  );
};
