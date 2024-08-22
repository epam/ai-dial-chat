import { IconChevronDown } from '@tabler/icons-react';
import React, { useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getPublicItemIdWithoutVersion } from '@/src/utils/server/api';

import { FeatureType, ShareEntity } from '@/src/types/common';
import { PublicVersionGroups } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';

import { Menu, MenuItem } from '../../Common/DropdownMenu';

interface Props {
  entity: ShareEntity;
  featureType: FeatureType;
  onChangeSelectedVersion: (
    versionGroupId: string,
    newVersion: NonNullable<PublicVersionGroups[string]>['selectedVersion'],
    oldVersion: NonNullable<PublicVersionGroups[string]>['selectedVersion'],
  ) => void;
}

export function VersionSelector({
  entity,
  featureType,
  onChangeSelectedVersion,
}: Props) {
  const { t } = useTranslation(Translation.Chat);

  const [isVersionSelectOpen, setIsVersionSelectOpen] = useState(false);

  const selector =
    featureType === FeatureType.Chat
      ? ConversationsSelectors
      : PromptsSelectors;

  const publicVersionGroups = useAppSelector(
    selector.selectPublicVersionGroups,
  );

  const currentVersionGroupId = entity.publicationInfo?.version
    ? getPublicItemIdWithoutVersion(entity.publicationInfo.version, entity.id)
    : null;
  const currentVersionGroup = currentVersionGroupId
    ? publicVersionGroups[currentVersionGroupId]
    : null;

  if (!entity.publicationInfo?.action) {
    if (!currentVersionGroup || !currentVersionGroupId) {
      return null;
    }

    return (
      <Menu
        onOpenChange={setIsVersionSelectOpen}
        disabled={currentVersionGroup.allVersions.length <= 1}
        trigger={
          <button
            disabled={currentVersionGroup.allVersions.length <= 1}
            className={classNames(
              'flex gap-1 text-sm',
              currentVersionGroup.allVersions.length <= 1 && 'cursor-default',
            )}
          >
            {t('v. ')}
            {currentVersionGroup.selectedVersion.version}
            {currentVersionGroup.allVersions.length > 1 && (
              <IconChevronDown
                className={classNames(
                  'shrink-0 text-primary transition-all',
                  isVersionSelectOpen && 'rotate-180',
                )}
                size={18}
              />
            )}
          </button>
        }
      >
        {currentVersionGroup.allVersions.map(({ version, id }) => {
          if (currentVersionGroup.selectedVersion.version === version) {
            return null;
          }

          return (
            <MenuItem
              onClick={() =>
                onChangeSelectedVersion(
                  currentVersionGroupId,
                  { version, id },
                  currentVersionGroup.selectedVersion,
                )
              }
              className="hover:bg-accent-primary-alpha"
              item={<span>{version}</span>}
              key={id}
            />
          );
        })}
      </Menu>
    );
  }

  if (!entity.publicationInfo.version) {
    return null;
  }

  return (
    <p className="text-sm">
      {t('v.')} {entity.publicationInfo.version}
    </p>
  );
}
