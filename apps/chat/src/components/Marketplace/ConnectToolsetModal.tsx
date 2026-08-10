import { useCallback, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getModelName, isDialAiEntityModel } from '@/src/utils/app/application';
import { getGroupMarketplaceEntityKey } from '@/src/utils/app/marketplace';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { MarketplaceActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceSelectors,
  ModelsSelectors,
  UISelectors,
} from '@/src/store/selectors';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';
import { ToolsetLinkButton } from '@/src/components/Marketplace/ToolsetLinkButton';

import { DialPopup, PopupSize } from '@epam/ai-dial-ui-kit';

interface ConnectToolsetModalProps {
  entity: MarketplaceEntity;
}

const view = withRenderWhenEntities<ConnectToolsetModalProps>({
  entity: MarketplaceSelectors.selectConnectLinkEntity,
})(({ entity }: ConnectToolsetModalProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();

  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const locale = useAppSelector(UISelectors.selectLocale);

  const isApplication = isDialAiEntityModel(entity);

  const allVersions = useMemo(
    () =>
      (isApplication ? allModels : allToolsets).filter(
        (t) =>
          getGroupMarketplaceEntityKey(t) ===
          getGroupMarketplaceEntityKey(entity),
      ),
    [allModels, allToolsets, entity, isApplication],
  );

  const handleClose = useCallback(() => {
    dispatch(MarketplaceActions.setConnectLinkEntity());
  }, [dispatch]);

  const handleSelectVersion = useCallback(
    (entity: MarketplaceEntity) => {
      dispatch(MarketplaceActions.setConnectLinkEntity(entity));
    },
    [dispatch],
  );

  return (
    <DialPopup
      portalId="chat"
      open
      header={
        isApplication
          ? MarketplaceI18nKeys.ConnectApplication
          : MarketplaceI18nKeys.ConnectToolset
      }
      size={PopupSize.Sm}
      className="!h-auto"
      onClose={handleClose}
    >
      <div className="flex flex-col divide-y divide-tertiary">
        <div className="flex gap-3 px-6 py-4">
          <ModelIcon size={40} entityId={entity.id} entity={entity} />

          <div className="flex flex-col justify-center gap-1">
            <span className="text-sm font-semibold text-primary">
              {getModelName(entity, locale)}
            </span>
            {entity.version ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-primary">
                  {t(MarketplaceI18nKeys.VersionPrefixMarketplace)}
                </span>

                <ModelVersionSelect
                  entities={allVersions}
                  currentEntity={entity}
                  onSelect={handleSelectVersion}
                  className="truncate"
                  triggerClassName="!text-xs bg-layer-4 rounded p-1"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="p-6">
          <p className="mb-3 text-sm text-secondary">
            {t(
              isApplication
                ? MarketplaceI18nKeys.CopyApplicationEndpointURL
                : MarketplaceI18nKeys.CopyToolsetEndpointURL,
            )}
          </p>
          <ToolsetLinkButton entity={entity} />
        </div>
      </div>
    </DialPopup>
  );
});

export const ConnectToolsetModal = view;
