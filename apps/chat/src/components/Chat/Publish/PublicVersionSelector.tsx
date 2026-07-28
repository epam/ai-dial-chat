import { IconChevronDown } from '@tabler/icons-react';
import React, { useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { groupAllVersions } from '@/src/utils/app/common';
import { getIdWithoutRootPathSegments } from '@/src/utils/app/id';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ModelsSelectors,
  PublicationSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { stopBubbling } from '@/src/constants/chat';
import { ChatI18nKeys } from '@/src/constants/i18n';
import { NA_VERSION } from '@/src/constants/publication';

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
  triggerTextClassName?: string;
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
  triggerTextClassName,
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
  const modelsVersionGroup = useAppSelector((state) =>
    ModelsSelectors.selectModelsVersionGroupByGroupId(
      state,
      publicVersionGroupId,
    ),
  );
  const toolsetsVersionGroup = useAppSelector((state) =>
    ToolsetSelectors.selectToolsetVersionGroupByGroupId(
      state,
      publicVersionGroupId,
    ),
  );
  const publishModel = useAppSelector(PublicationSelectors.selectPublishModel);

  const mappedModelsAndToolsetsVersionGroup = useMemo(() => {
    return [...modelsVersionGroup, ...toolsetsVersionGroup].map((model) => ({
      id: model.id,
      version: model.version ?? NA_VERSION,
    }));
  }, [modelsVersionGroup, toolsetsVersionGroup]);

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
    if (
      !currentVersionGroup?.allVersions &&
      !mappedModelsAndToolsetsVersionGroup.length
    ) {
      return [];
    }

    if (!groupVersions) {
      if (currentVersionGroup?.allVersions) {
        return currentVersionGroup.allVersions;
      }

      return mappedModelsAndToolsetsVersionGroup;
    }

    if (currentVersionGroup?.allVersions) {
      return groupAllVersions(currentVersionGroup.allVersions);
    }

    return groupAllVersions(mappedModelsAndToolsetsVersionGroup);
  }, [
    currentVersionGroup?.allVersions,
    groupVersions,
    mappedModelsAndToolsetsVersionGroup,
  ]);

  if (!currentVersionGroup && !mappedModelsAndToolsetsVersionGroup.length) {
    return null;
  }

  const publishModelFolder =
    publishModel && getIdWithoutRootPathSegments(publishModel.entity.folderId);
  const mappedAllVersions = allVersions.map(({ id, version }) => {
    return {
      id: publishModelFolder ? id.replace(`${publishModelFolder}/`, '') : id,
      version,
    };
  });
  const isAllSelected =
    selectedCheckboxVersionIds?.length === mappedAllVersions.length;
  const currentVersion =
    currentVersionGroup?.selectedVersion?.version ??
    mappedAllVersions.at(0)?.version;

  return (
    <Menu
      onOpenChange={setIsVersionSelectOpen}
      className="flex min-w-fit shrink-0 items-center"
      listClassName="min-w-fit"
      disabled={mappedAllVersions.length <= 1}
      placement="bottom-end"
      strategy="fixed"
      enableAncestorScroll
      trigger={
        <DialLinkButton
          onClick={stopBubbling}
          disabled={mappedAllVersions.length <= 1}
          className={classNames(
            'flex px-0',
            mappedAllVersions.length <= 1 && 'cursor-default',
            btnClassNames,
            readonly
              ? 'text-xs text-secondary'
              : 'text-primary hover:text-primary',
          )}
          data-qa="version"
          textClassName={classNames(
            'whitespace-nowrap font-normal leading-normal',
            triggerTextClassName,
          )}
          label={
            overrideTriggerText ??
            `${textBeforeSelector ?? t(ChatI18nKeys.VersionPrefix)} ${currentVersion}`
          }
          iconAfter={
            mappedAllVersions.length > 1 && (
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
            'flex items-center gap-1 py-[6.5px] ps-2 hover:bg-accent-primary-alpha',
            isAllSelected && 'bg-accent-primary-alpha',
          )}
        >
          <DialCheckbox
            id={'all'}
            className="me-3 shrink-0"
            checked={isAllSelected}
            indeterminate={
              !isAllSelected && !!selectedCheckboxVersionIds?.length
            }
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
          <p>{t(ChatI18nKeys.All)}</p>
        </li>
      )}
      {mappedAllVersions.map(({ id, version }) => {
        const isSelected = currentVersion === version;

        return (
          <li
            key={version ?? id}
            className={classNames(
              'flex items-center gap-1 hover:bg-accent-primary-alpha',
              isSelected && 'bg-accent-primary-alpha',
              onSelectCheckboxVersion && 'ps-2',
            )}
          >
            {onSelectCheckboxVersion && (
              <DialCheckbox
                id={version ?? id}
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
