import { IconChevronDown } from '@tabler/icons-react';
import React, { useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { groupAllVersions } from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import { getIdWithoutRootPathSegments, getRootId } from '@/src/utils/app/id';
import { getPublicItemIdWithoutVersion } from '@/src/utils/server/api';

import { FeatureType } from '@/src/types/common';
import { PublicVersionGroups } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';

import { stopBubbling } from '@/src/constants/chat';
import { PUBLIC_URL_PREFIX } from '@/src/constants/public';

import { Menu, MenuItem } from '../../Common/DropdownMenu';

import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';

interface Props {
  entity: ShareEntity;
  featureType: FeatureType;
  btnClassNames?: string;
  readonly?: boolean;
  groupVersions?: boolean;
  customEntityId?: string;
  textBeforeSelector?: string | null;
  hideIfVersionsNotFound?: boolean;
  onChangeSelectedVersion?: (
    versionGroupId: string,
    newVersion: NonNullable<PublicVersionGroups[string]>['selectedVersion'],
    oldVersion: NonNullable<PublicVersionGroups[string]>['selectedVersion'],
  ) => void;
}

export function VersionSelector({
  entity,
  featureType,
  btnClassNames,
  readonly,
  groupVersions,
  customEntityId,
  textBeforeSelector,
  hideIfVersionsNotFound,
  onChangeSelectedVersion,
}: Props) {
  const { t } = useTranslation(Translation.Chat);

  const [isVersionSelectOpen, setIsVersionSelectOpen] = useState(false);

  const publicVersionGroups = useAppSelector(
    PublicationSelectors.selectPublicVersionGroups,
  );

  const entityId = customEntityId ? customEntityId : entity.id;
  const currentVersionGroupId = constructPath(
    getRootId({ featureType, bucket: PUBLIC_URL_PREFIX }),
    getIdWithoutRootPathSegments(
      entity.publicationInfo?.version
        ? getPublicItemIdWithoutVersion(
            entity.publicationInfo.version,
            entityId,
          )
        : entityId,
    ),
  );

  const currentVersionGroup = currentVersionGroupId
    ? publicVersionGroups[currentVersionGroupId]
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

  if (hideIfVersionsNotFound && !allVersions.length) {
    return null;
  }

  if (!entity.publicationInfo?.action || readonly) {
    if (!currentVersionGroup || !currentVersionGroupId) {
      return null;
    }

    return (
      <Menu
        onOpenChange={setIsVersionSelectOpen}
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
                    currentVersionGroupId,
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

  if (!entity.publicationInfo?.version) {
    return null;
  }

  return (
    <p
      className={classNames(
        'shrink-0 text-sm',
        entity.publicationInfo?.action === PublishActions.DELETE &&
          'text-error',
      )}
    >
      {t('v.')} {entity.publicationInfo.version}
    </p>
  );
}
