import { IconChevronDown } from '@tabler/icons-react';
import React, { useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { groupAllVersions } from '@/src/utils/app/common';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/selectors';

import { stopBubbling } from '@/src/constants/chat';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import { DialCheckbox, DialLinkButton } from '@epam/ai-dial-ui-kit';

interface Props {
  publicVersionGroupId: string;
  btnClassNames?: string;
  readonly?: boolean;
  groupVersions?: boolean;
  textBeforeSelector?: string | null;
  selectedEntityId?: string;
  excludeEntityId?: string;
  selectedCheckboxVersionIds?: string[];
  overrideTriggerText?: string;
  onChangeSelectedVersion?: (newVersionId: string) => void;
  onSelectCheckboxVersion?: (versionId: string) => void;
}

export function PublicVersionSelector({
  publicVersionGroupId,
  btnClassNames,
  readonly,
  groupVersions,
  textBeforeSelector,
  selectedEntityId,
  excludeEntityId,
  selectedCheckboxVersionIds,
  overrideTriggerText,
  onChangeSelectedVersion,
  onSelectCheckboxVersion,
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
  const publishModel = useAppSelector(PublicationSelectors.selectPublishModel);

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
        ),
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
        selectedVersion: selected,
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

  const currentVersion = currentVersionGroup?.selectedVersion?.version;
  const isAllSelected =
    selectedCheckboxVersionIds?.length === allVersions.length;
  const publishModelFolder = publishModel?.entity.folderId
    .split('/')
    .slice(2)
    .join('/');
  const mappedAllVersions = allVersions.map(({ id, version }) => {
    return {
      id: publishModelFolder ? id.replace(`${publishModelFolder}/`, '') : id,
      version,
    };
  });

  return (
    <Menu
      onOpenChange={setIsVersionSelectOpen}
      dropdownWidth={82}
      className="flex shrink-0 items-center"
      disabled={allVersions.length <= 1}
      placement="bottom-end"
      trigger={
        <DialLinkButton
          onClick={(e) => stopBubbling(e)}
          disabled={allVersions.length <= 1}
          className={classNames(
            'flex px-0 text-primary hover:text-primary',
            allVersions.length <= 1 &&
              '!cursor-default !text-controls-permanent',
            btnClassNames,
            readonly && 'text-xs !text-secondary',
          )}
          data-qa="version"
          textClassName="font-normal whitespace-nowrap leading-normal"
          label={
            overrideTriggerText ??
            `${textBeforeSelector ?? t('v.')} ${currentVersion}`
          }
          iconAfter={
            allVersions.length > 1 && (
              <IconChevronDown
                className={classNames(
                  'shrink-0 transition-all',
                  isVersionSelectOpen && 'rotate-180',
                  readonly && '!text-secondary',
                )}
                size={readonly ? 16 : 18}
              />
            )
          }
        />
      }
    >
      {onSelectCheckboxVersion && (
        <li
          className={classNames(
            'flex items-center gap-1 py-[6.5px] pl-2 hover:bg-accent-primary-alpha',
            isAllSelected && 'bg-accent-primary-alpha',
          )}
        >
          <DialCheckbox
            id={'all'}
            className="mr-3 shrink-0"
            checked={isAllSelected}
            onChange={() => {
              if (!isAllSelected) {
                mappedAllVersions.forEach(({ id }) => {
                  if (!selectedCheckboxVersionIds?.includes(id)) {
                    onSelectCheckboxVersion(id);
                  }
                });
                return;
              }

              mappedAllVersions.forEach(({ id }) => {
                onSelectCheckboxVersion(id);
              });
            }}
          />
          <p>{t('All')}</p>
        </li>
      )}
      {mappedAllVersions.map(({ id, version }) => {
        const isSelected = currentVersion === version;

        return (
          <li
            key={id}
            className={classNames(
              'flex items-center gap-1 hover:bg-accent-primary-alpha',
              isSelected && 'bg-accent-primary-alpha',
              onSelectCheckboxVersion && 'pl-2',
            )}
          >
            {onSelectCheckboxVersion && (
              <DialCheckbox
                id={id}
                className="shrink-0"
                checked={!!selectedCheckboxVersionIds?.includes(id)}
                onChange={() => onSelectCheckboxVersion(id)}
              />
            )}
            <MenuItem
              disabled={isSelected}
              onClick={(e) => {
                stopBubbling(e);
                setIsVersionSelectOpen(false);

                return onChangeSelectedVersion?.(id);
              }}
              item={<span>{version}</span>}
            />
          </li>
        );
      })}
    </Menu>
  );
}
