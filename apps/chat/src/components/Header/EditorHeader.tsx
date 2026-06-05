import { IconChevronDown, IconLogout } from '@tabler/icons-react';
import { MouseEvent, useCallback, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { PartialBy } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { Stepper } from '@/src/components/Common/Stepper';
import { BaseHeader } from '@/src/components/Header/BaseHeader';

import { DialLinkButton } from '@epam/ai-dial-ui-kit';

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

  const [menuOpen, setMenuOpen] = useState(false);

  const handleTabClose = useCallback(
    (tab: PartialBy<EditorHeaderTab<T>, 'label'>) => {
      onTabClick(tab);
      setMenuOpen(false);
    },
    [onTabClick],
  );

  return (
    <BaseHeader
      dataQa={dataQa}
      onLogoClick={onLogoClick}
      logoWrapperClassName="hidden xl:flex"
      rightItemsWrapperClassName="flex-row-reverse !justify-start max-xl:[&>div:first-of-type]:hidden"
      LeftItems={
        <div className="flex h-full shrink-0 gap-4 md:pl-3">
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
                        'w-full px-3 py-2 text-start text-sm transition-colors',
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
            className="hidden shrink-0 items-center pl-1 text-primary md:flex xl:pl-0"
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
      }
      RightItems={
        <div className="flex h-full items-center xl:mr-2 xl:border-r xl:border-secondary">
          <DialLinkButton
            onClick={onSave}
            data-qa="save-and-exit"
            aria-label={saveLabel}
            iconBefore={<IconLogout size={20} stroke={1.5} />}
            label={t(saveLabel ?? ChatI18nKeys.SaveAndExit)}
          />
        </div>
      }
    />
  );
};
