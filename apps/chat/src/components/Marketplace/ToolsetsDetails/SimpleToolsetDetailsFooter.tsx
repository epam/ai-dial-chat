import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { LoginButton } from '@/src/components/Marketplace/ToolsetsDetails/LoginButton';
import { ToolsetDetailsFooterProps } from '@/src/components/Marketplace/ToolsetsDetails/ToolsetDetails';

import { DialNeutralButton } from '@epam/ai-dial-ui-kit';

export const SimpleToolsetDetailsFooter: React.FC<
  ToolsetDetailsFooterProps
> = ({ entity, onChangeVersion, onRemove }) => {
  const { t } = useTranslation(Translation.Marketplace);

  return (
    <div className="flex items-center justify-end gap-4 p-4">
      <div className="flex items-center">
        <ModelVersionSelect
          className="h-max"
          entities={[entity]}
          onSelect={onChangeVersion}
          currentEntity={entity}
          showVersionPrefix
        />
      </div>

      <div className="flex items-center gap-4">
        {onRemove && (
          <DialNeutralButton
            onClick={() => onRemove(entity)}
            data-qa="remove-from-details"
            label={t('Remove')}
          />
        )}

        <LoginButton entity={entity} />
      </div>
    </div>
  );
};
