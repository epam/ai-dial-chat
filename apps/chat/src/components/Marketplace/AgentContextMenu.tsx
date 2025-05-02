import {
  IconFileDescription,
  IconLink,
  IconPencilMinus,
  IconTrashX,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { useApplicationMenuActions } from '@/src/hooks/useApplicationActions';

import {
  getApplicationSimpleStatus,
  getPlayerCaption,
  isApplicationPublic,
  isApplicationStatusUpdating,
  isExecutableApp,
} from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { canWriteSharedWithMe } from '@/src/utils/app/share';

import { SimpleApplicationStatus } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { AuthSelectors } from '@/src/store/auth/auth.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import {
  PlayerContextIconClasses,
  PlayerContextIcons,
} from '@/src/constants/marketplace';

import ContextMenu from '../Common/ContextMenu';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { Feature } from '@epam/ai-dial-shared';

interface Props {
  entity: DialAIEntityModel;
  className?: string;
  isPreview?: boolean;
}

export const AgentContextMenu: React.FC<Props> = ({
  entity,
  className,
  isPreview = false,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  const isCodeAppsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CodeApps),
  );
  const isApplicationsSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ApplicationsSharing),
  );

  const {
    handleCopy,
    handleDelete,
    handleEdit,
    handleOpenApplicationLogs,
    handleOpenSharing,
    handleOpenUnshare,
    handlePublish,
    handleUnpublish,
    handleUpdateFunctionStatus,
  } = useApplicationMenuActions(entity);

  const isMyApp = isMyApplication(entity);
  const isPublicApp = isApplicationPublic(entity);
  const canWrite = canWriteSharedWithMe(entity);
  const isModifyDisabled = isApplicationStatusUpdating(entity);
  const playerStatus = getApplicationSimpleStatus(entity);
  const hasEditPermissions = isMyApp || canWrite;
  const isExecutable = isExecutableApp(entity) && hasEditPermissions;

  const PlayerContextIcon = PlayerContextIcons[playerStatus];

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Copy link'),
        dataQa: 'application-copy-link',
        display: isPublicApp,
        Icon: IconLink,
        onClick: handleCopy,
      },
      {
        name: t(getPlayerCaption(entity)),
        dataQa: 'status-change',
        disabled: playerStatus === SimpleApplicationStatus.UPDATING,
        display: isExecutable && isCodeAppsEnabled && hasEditPermissions,
        Icon: PlayerContextIcon,
        iconClassName: PlayerContextIconClasses[playerStatus],
        onClick: handleUpdateFunctionStatus,
      },
      {
        name: t('Edit'),
        dataQa: 'edit',
        display: hasEditPermissions,
        Icon: IconPencilMinus,
        onClick: handleEdit,
      },
      {
        name: t('Share'),
        dataQa: 'share',
        display: isMyApp && isApplicationsSharingEnabled,
        Icon: IconUserShare,
        onClick: handleOpenSharing,
      },
      {
        name: t('Unshare'),
        dataQa: 'unshare',
        display: !!entity.sharedWithMe && isApplicationsSharingEnabled,
        Icon: IconUserShare,
        onClick: handleOpenUnshare,
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display: isMyApp || isPreview,
        Icon: IconWorldShare,
        onClick: handlePublish,
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display: isEntityIdPublic(entity),
        Icon: UnpublishIcon,
        onClick: handleUnpublish,
      },
      {
        name: t('Logs'),
        dataQa: 'app-logs',
        display:
          !!isExecutable && playerStatus === SimpleApplicationStatus.UNDEPLOY,
        Icon: IconFileDescription,
        onClick: handleOpenApplicationLogs,
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display: isMyApp || isPreview,
        disabled: isModifyDisabled,
        Icon: IconTrashX,
        iconClassName: 'stroke-error',
        onClick: handleDelete,
      },
    ],
    [
      t,
      isPublicApp,
      handleCopy,
      entity,
      playerStatus,
      isExecutable,
      isCodeAppsEnabled,
      hasEditPermissions,
      PlayerContextIcon,
      handleUpdateFunctionStatus,
      handleEdit,
      isMyApp,
      isApplicationsSharingEnabled,
      handleOpenSharing,
      handleOpenUnshare,
      isPreview,
      handlePublish,
      handleUnpublish,
      handleOpenApplicationLogs,
      isModifyDisabled,
      handleDelete,
    ],
  );

  return (
    <ContextMenu
      menuItems={menuItems}
      featureType={FeatureType.Application}
      triggerIconHighlight
      triggerIconSize={18}
      className={classNames('m-0', className)}
    />
  );
};
