import { FC, useCallback, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getGroupMarketplaceEntityKey } from '@/src/utils/app/marketplace';

import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { MarketplaceActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import { NA_VERSION } from '@/src/constants/publication';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';
import { ToolsetLinkButton } from '@/src/components/Marketplace/ToolsetLinkButton';

import { DialPopup, PopupSize } from '@epam/ai-dial-ui-kit';

interface ConnectToolsetModalProps {
  entity: ToolsetModel;
}

const ConnectToolsetModalView: FC<ConnectToolsetModalProps> = ({ entity }) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();

  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);

  const allVersions = useMemo(
    () =>
      allToolsets.filter(
        (t) =>
          getGroupMarketplaceEntityKey(t) ===
          getGroupMarketplaceEntityKey(entity),
      ),
    [allToolsets, entity],
  );

  const handleClose = useCallback(() => {
    dispatch(MarketplaceActions.setConnectLinkEntity());
  }, [dispatch]);

  const handleSelectVersion = useCallback(
    (entity: ToolsetModel) => {
      dispatch(MarketplaceActions.setConnectLinkEntity(entity));
    },
    [dispatch],
  );

  return (
    <DialPopup
      portalId="chat"
      open
      header={MarketplaceI18nKeys.ConnectToolset}
      size={PopupSize.Sm}
      onClose={handleClose}
    >
      <div className="flex flex-col divide-y divide-tertiary">
        <div className="flex gap-3 px-6 py-4">
          <ModelIcon size={40} entityId={entity.id} entity={entity} />

          <div className="flex flex-col justify-center gap-1">
            <span className="text-sm font-semibold text-primary">
              {entity.name}
            </span>

            <div className="flex items-center gap-1">
              <span className="text-xs text-primary">
                {t(MarketplaceI18nKeys.VersionPrefixMarketplace)}
              </span>

              {entity.version ? (
                <ModelVersionSelect
                  entities={allVersions}
                  currentEntity={entity}
                  onSelect={handleSelectVersion}
                  className="truncate"
                  triggerClassName="!text-xs bg-layer-4 rounded p-1"
                />
              ) : (
                <span className="text-xs text-secondary">{t(NA_VERSION)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="mb-3 text-sm text-secondary">
            {t(MarketplaceI18nKeys.CopyToolsetEndpointURL)}
          </p>
          <ToolsetLinkButton id={entity.id} />
        </div>
      </div>
    </DialPopup>
  );
};

export const ConnectToolsetModal =
  withRenderWhenEntities<ConnectToolsetModalProps>({
    entity: MarketplaceSelectors.selectConnectLinkEntity,
  })(ConnectToolsetModalView);
