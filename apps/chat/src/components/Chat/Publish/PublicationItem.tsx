import { IconAlertCircle } from '@tabler/icons-react';
import { ChangeEvent, ReactNode, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { findLatestVersion, isVersionValid } from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/folders';
import { getIdWithoutRootPathSegments, getRootId } from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import {
  getVersionFromId,
  parseApplicationApiKey,
} from '@/src/utils/server/api';

import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';

import { DEFAULT_VERSION, PUBLIC_URL_PREFIX } from '@/src/constants/public';

import Tooltip from '@/src/components/Common/Tooltip';

import { PublicVersionSelector } from './PublicVersionSelector';

import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';

interface ReadonlyPublicItemsProps {
  entityId: string;
  children: ReactNode;
  publishAction: PublishActions;
}

const ReadonlyPublicationItem: React.FC<ReadonlyPublicItemsProps> = ({
  children,
  publishAction,
  entityId,
}) => {
  return (
    <div className="flex w-full items-center gap-2">
      {children}
      <span
        className={classNames(
          'shrink-0 text-xs',
          publishAction === PublishActions.DELETE && 'text-error',
        )}
        data-qa="version"
      >
        {getVersionFromId(entityId)}
      </span>
    </div>
  );
};

interface PublicItemsProps {
  path: string;
  constructedPublicId: string;
  children: ReactNode;
  entity: ShareEntity;
  type: SharingType;
  publishAction: PublishActions;
  onChangeVersion: (id: string, version: string) => void;
}

const EditablePublicationItem: React.FC<PublicItemsProps> = ({
  path,
  children,
  entity,
  type,
  publishAction,
  constructedPublicId,
  onChangeVersion,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const [isVersionInvalid, setIsVersionInvalid] = useState(false);
  const [version, setVersion] = useState('');

  const publicVersionGroups = useAppSelector(
    PublicationSelectors.selectPublicVersionGroups,
  );

  const handleVersionChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!onChangeVersion) {
      return;
    }

    const versionParts = e.target.value.split('.');

    if (
      versionParts.length < 4 &&
      versionParts.filter(Boolean).every((part) => /^\d+$/.test(part))
    ) {
      setVersion(e.target.value);
      onChangeVersion(entity.id, e.target.value);
    }
  };

  const allVersions = useMemo(
    () => publicVersionGroups[constructedPublicId]?.allVersions,
    [constructedPublicId, publicVersionGroups],
  );

  const latestVersion = useMemo(() => {
    if (allVersions) {
      return findLatestVersion(allVersions.map(({ version }) => version));
    }

    return undefined;
  }, [allVersions]);

  useEffect(() => {
    if (onChangeVersion) {
      const versionParts = latestVersion?.split('.');

      if (versionParts && isVersionValid(latestVersion)) {
        versionParts[2] = String(+versionParts[2] + 1);
        setVersion(versionParts.join('.'));
        onChangeVersion(entity.id, versionParts.join('.'));
      } else {
        setVersion(DEFAULT_VERSION);
        onChangeVersion(entity.id, DEFAULT_VERSION);
      }
    }
  }, [entity.id, latestVersion, onChangeVersion]);

  if (!onChangeVersion) {
    return (
      <div className="flex w-full items-center gap-2">
        {children}
        <span
          className={classNames(
            'shrink-0 text-xs',
            publishAction === PublishActions.DELETE && 'text-error',
          )}
          data-qa="version"
        >
          {parseApplicationApiKey(constructedPublicId).version}
        </span>
      </div>
    );
  }

  const isVersionAllowed =
    !allVersions ||
    !allVersions.some((versionGroup) => version === versionGroup.version);

  const handleBlur = () => {
    if (!isVersionValid(version)) {
      setIsVersionInvalid(true);
    }
  };

  return (
    <div className="flex w-full items-center gap-2">
      {children}
      <PublicVersionSelector
        textBeforeSelector={t('Last: ')}
        publicVersionGroupId={constructPath(
          getRootId({
            featureType: EnumMapper.getFeatureTypeBySharingType(type),
            bucket: PUBLIC_URL_PREFIX,
          }),
          path,
          getIdWithoutRootPathSegments(entity.id),
        )}
        readonly
        groupVersions
      />
      <div className="relative">
        {!isVersionAllowed ||
          (isVersionInvalid && (
            <Tooltip
              tooltip={t(
                !isVersionAllowed
                  ? 'This version already exists'
                  : 'Version format is invalid (example: 0.0.1)',
              )}
              contentClassName="text-error text-xs"
              triggerClassName="pl-0.5 absolute text-error top-1/2 -translate-y-1/2"
            >
              <IconAlertCircle size={14} />
            </Tooltip>
          ))}
        <input
          onBlur={handleBlur}
          onFocus={() => setIsVersionInvalid(false)}
          value={version}
          onChange={handleVersionChange}
          placeholder={DEFAULT_VERSION}
          className={classNames(
            'm-0 h-[24px] w-[70px] border-b bg-transparent p-1 pl-[18px] text-right text-xs outline-none placeholder:text-secondary',
            isVersionAllowed
              ? 'border-primary focus-visible:border-accent-primary'
              : 'border-b-error',
            isVersionInvalid && 'border-b-error',
          )}
          data-qa="version"
        />
      </div>
    </div>
  );
};

interface Props {
  path: string;
  children: ReactNode;
  entity: ShareEntity;
  type: SharingType;
  publishAction: PublishActions;
  parentFolderNames?: string[];
  onChangeVersion?: (id: string, version: string) => void;
}

export const PublicationItem: React.FC<Props> = ({
  path,
  entity,
  type,
  parentFolderNames = [],
  children,
  publishAction,
  onChangeVersion,
}) => {
  if (!onChangeVersion || publishAction === PublishActions.DELETE) {
    return (
      <ReadonlyPublicationItem
        entityId={entity.id}
        publishAction={publishAction}
      >
        {children}
      </ReadonlyPublicationItem>
    );
  }

  const constructedPublicId = constructPath(
    getRootId({
      featureType: EnumMapper.getFeatureTypeBySharingType(type),
      bucket: PUBLIC_URL_PREFIX,
    }),
    path,
    ...parentFolderNames,
    splitEntityId(entity.id).name,
  );

  return (
    <EditablePublicationItem
      path={path}
      onChangeVersion={onChangeVersion}
      entity={entity}
      publishAction={publishAction}
      type={type}
      constructedPublicId={constructedPublicId}
    >
      {children}
    </EditablePublicationItem>
  );
};
