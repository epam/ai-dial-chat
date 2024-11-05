import { IconChevronDown } from '@tabler/icons-react';
import React, { useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { groupAllVersions } from '@/src/utils/app/common';

import { PublicVersionGroups } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';

import { stopBubbling } from '@/src/constants/chat';

import { Menu, MenuItem } from '../../Common/DropdownMenu';

interface Props {
  publicVersionGroupId: string;
  btnClassNames?: string;
  readonly?: boolean;
  groupVersions?: boolean;
  textBeforeSelector?: string | null;
  onChangeSelectedVersion?: (
    versionGroupId: string,
    newVersion: NonNullable<PublicVersionGroups[string]>['selectedVersion'],
    oldVersion: NonNullable<PublicVersionGroups[string]>['selectedVersion'],
  ) => void;
}

export function PublicVersionSelector({
  publicVersionGroupId,
  btnClassNames,
  readonly,
  groupVersions,
  textBeforeSelector,
  onChangeSelectedVersion,
}: Props) {
  const { t } = useTranslation(Translation.Chat);

  const [isVersionSelectOpen, setIsVersionSelectOpen] = useState(false);

  const publicVersionGroups = useAppSelector(
    PublicationSelectors.selectPublicVersionGroups,
  );

  const currentVersionGroup = publicVersionGroupId
    ? publicVersionGroups[publicVersionGroupId]
    : null;

  const allVersions = useMemo(() => {
    if (!currentVersionGroup?.allVersions) {
      return [];
    }

    if (!groupVersions) {
      return currentVersionGroup.allVersions;
    }

    return groupAllVersions(currentVersionGroup.allVersions);
  }, [currentVersionGroup?.allVersions, groupVersions]);

  if (!currentVersionGroup) {
    return null;
  }

  return (
    <Menu
      onOpenChange={setIsVersionSelectOpen}
      dropdownWidth={82}
      className="flex shrink-0 items-center"
      disabled={allVersions.length <= 1}
      trigger={
        <button
          onClick={(e) => stopBubbling(e)}
          disabled={allVersions.length <= 1}
          className={classNames(
            'flex gap-1 text-sm',
            allVersions.length <= 1 && 'cursor-default',
            btnClassNames,
            readonly && 'text-xs text-secondary',
          )}
        >
          {textBeforeSelector ? textBeforeSelector : t('v. ')}
          {currentVersionGroup.selectedVersion.version}
          {allVersions.length > 1 && (
            <IconChevronDown
              className={classNames(
                'shrink-0 transition-all',
                isVersionSelectOpen && 'rotate-180',
                readonly && 'text-secondary',
              )}
              size={readonly ? 16 : 18}
            />
          )}
        </button>
      }
    >
      {allVersions.map(({ version, id }) => {
        if (currentVersionGroup.selectedVersion.version === version) {
          return null;
        }

        if (onChangeSelectedVersion && !readonly) {
          return (
            <MenuItem
              onClick={(e) => {
                stopBubbling(e);
                setIsVersionSelectOpen(false);

                return onChangeSelectedVersion(
                  publicVersionGroupId,
                  { version, id },
                  currentVersionGroup.selectedVersion,
                );
              }}
              className="hover:bg-accent-primary-alpha"
              item={<span>{version}</span>}
              key={id}
            />
          );
        }

        return (
          <li
            className="cursor-default list-none px-3 py-[6.5px] hover:bg-accent-primary-alpha"
            key={id}
          >
            {version}
          </li>
        );
      })}
    </Menu>
  );
}
