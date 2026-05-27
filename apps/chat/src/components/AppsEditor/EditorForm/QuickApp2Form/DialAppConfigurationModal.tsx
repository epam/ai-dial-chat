import { FC, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { parseEntityApiKey } from '@/src/utils/server/api';

import { DialAppToolset, DialAppTransportType } from '@/src/types/quick-apps';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import { NA_VERSION } from '@/src/constants/publication';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

import {
  DialPopup,
  DialPrimaryButton,
  DialRadioGroup,
  PopupSize,
  RadioGroupOrientation,
} from '@epam/ai-dial-ui-kit';

interface DialAppConfigurationModalProps {
  onClose: () => void;
  toolset: DialAppToolset;
  onApply: (toolset: DialAppToolset) => void;
}

export const DialAppConfigurationModal: FC<DialAppConfigurationModalProps> = ({
  onClose,
  toolset,
  onApply,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const [transportType, setTransportType] = useState(
    toolset.transport ?? DialAppTransportType.MCP,
  );

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const entity = modelsMap[toolset.deployment_id];
  const { version: parsedVersion } = parseEntityApiKey(toolset.deployment_id, {
    parseVersion: true,
  });

  const version = entity?.version || parsedVersion || undefined;

  const handleSelect = (radioId: string) => {
    setTransportType(radioId as DialAppTransportType);
  };

  const handleApply = () => {
    onApply({
      ...toolset,
      transport: transportType,
    });
    onClose();
  };

  return (
    <DialPopup
      open
      header={t(MarketplaceI18nKeys.AdvancedSettings)}
      closeOnOutsideClick
      onClose={onClose}
      size={PopupSize.Sm}
    >
      <div className="flex flex-col divide-y divide-tertiary">
        <div className="flex items-center gap-3 px-6 py-4">
          <ModelIcon
            size={40}
            entityId={toolset.deployment_id}
            entity={entity}
          />

          <div className="flex flex-col justify-center gap-1 truncate">
            <span className="truncate text-sm font-semibold text-primary">
              {entity?.name ?? toolset.name}
            </span>
            {version && version !== NA_VERSION && (
              <span className="truncate text-xs text-primary">{version}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col px-6 py-4">
          <DialRadioGroup
            elementId="configuration-radio-group"
            radioButtons={[
              {
                id: DialAppTransportType.MCP,
                name: t(MarketplaceI18nKeys.MCP),
              },
              {
                id: DialAppTransportType.ChatCompletion,
                name: t(MarketplaceI18nKeys.ChatCompletion),
              },
            ]}
            activeRadioButton={transportType}
            orientation={RadioGroupOrientation.Column}
            onChange={handleSelect}
            containerClassName="mb-4"
            fieldTitle={t(MarketplaceI18nKeys.ConnectVia)}
            groupLabelClassName="mb-2"
          />

          <div className="flex justify-end">
            <DialPrimaryButton
              label={t(MarketplaceI18nKeys.ApplyChanges)}
              onClick={handleApply}
            />
          </div>
        </div>
      </div>
    </DialPopup>
  );
};
