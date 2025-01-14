import { IconChevronDown } from '@tabler/icons-react';
import React, { useEffect, useMemo, useState } from 'react';

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
  selectedEntityId?: string;
  excludeEntityId?: string;
}

export function PublicVersionSelector({
  publicVersionGroupId,
  btnClassNames,
  readonly,
  groupVersions,
  textBeforeSelector,
  onChangeSelectedVersion,
  selectedEntityId,
  excludeEntityId,
}: Props) {
  const { t } = useTranslation(Translation.Chat);

  const [isVersionSelectOpen, setIsVersionSelectOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(selectedEntityId);

  const versionGroup = useAppSelector((state) =>
    PublicationSelectors.selectPublicVersionGroupById(
      state,
      publicVersionGroupId,
    ),
  );

  useEffect(() => {
    setSelectedId(
      selectedEntityId ??
        (excludeEntityId !== versionGroup?.selectedVersion.id
          ? versionGroup?.selectedVersion.id
          : undefined),
    );
  }, [excludeEntityId, selectedEntityId, versionGroup?.selectedVersion.id]);

  const currentVersionGroup = useMemo(() => {
    if (!versionGroup || (!selectedId && !excludeEntityId)) {
      return versionGroup;
    }
    if (
      selectedId &&
      versionGroup.allVersions.some((ver) => ver.id === selectedId)
    ) {
      return {
        allVersions: excludeEntityId
          ? versionGroup.allVersions.filter((v) => v.id !== excludeEntityId)
          : versionGroup.allVersions,
        selectedVersion: versionGroup.allVersions.find(
          (v) => v.id === selectedId,
        )!,
      };
    }
    if (
      excludeEntityId &&
      versionGroup.allVersions.some((ver) => ver.id === excludeEntityId)
    ) {
      const selected = versionGroup.allVersions.find(
        (v) => v.id !== excludeEntityId,
      );
      setSelectedId(selected?.id);
      return {
        allVersions: excludeEntityId
          ? versionGroup.allVersions.filter((v) => v.id !== excludeEntityId)
          : versionGroup.allVersions,
        selectedVersion: selected!,
      };
    }
    return versionGroup;
  }, [excludeEntityId, selectedId, versionGroup]);

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
            'flex gap-1 whitespace-nowrap text-sm',
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
        if (onChangeSelectedVersion && !readonly) {
          return (
            <MenuItem
              disabled={currentVersionGroup.selectedVersion.version === version}
              onClick={(e) => {
                stopBubbling(e);
                setIsVersionSelectOpen(false);

                return onChangeSelectedVersion(
                  publicVersionGroupId,
                  { version, id },
                  currentVersionGroup.selectedVersion,
                );
              }}
              className={classNames(
                'hover:bg-accent-primary-alpha',
                currentVersionGroup.selectedVersion.version === version &&
                  'bg-accent-primary-alpha',
              )}
              item={<span>{version}</span>}
              key={id}
            />
          );
        }

        return (
          <li
            className={classNames(
              'cursor-default list-none px-3 py-[6.5px] hover:bg-accent-primary-alpha',
              currentVersionGroup.selectedVersion.version === version &&
                'bg-accent-primary-alpha',
            )}
            key={id}
          >
            {version}
          </li>
        );
      })}
    </Menu>
  );
}
